package br.com.khki.usecase.image;

import br.com.khki.infrastructure.storage.ImageStorage;
import br.com.khki.shared.api.ApiException;
import br.com.khki.shared.api.Contracts.*;
import br.com.khki.shared.domain.Status;
import br.com.khki.usecase.account.User;
import br.com.khki.usecase.bathroom.BathroomRepository;
import br.com.khki.usecase.contribution.ContributionService;
import br.com.khki.usecase.review.ReviewRepository;
import org.springframework.transaction.support.*;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.awt.image.BufferedImage;
import java.io.*;
import java.util.*;
import javax.imageio.ImageIO;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@Transactional
public class ImageService {

  private final BathroomRepository bathrooms;
  private final ReviewRepository reviews;
  private final ContributionService content;
  private final EntityManager entityManager;
  private final ImageStorage storage;

  public ImageService(BathroomRepository bathrooms, ReviewRepository reviews, ContributionService content, EntityManager entityManager, ImageStorage storage) {
    this.bathrooms = bathrooms;
    this.reviews = reviews;
    this.content = content;
    this.entityManager = entityManager;
    this.storage = storage;
  }

  public ContributionView upload(UUID bathroomId, UUID reviewId, UUID authorId, MultipartFile file, boolean registrationAttachment) {
    if (registrationAttachment && reviewId != null) throw new ApiException(HttpStatus.BAD_REQUEST, "Escolha apenas um vínculo para a foto.");
    var bathroom = bathrooms.findById(bathroomId).orElseThrow(ApiException::missing);
    br.com.khki.shared.domain.ModeratedContent parent;
    List<String> urls;
    if (reviewId != null) {
      var review = reviews.findById(reviewId).orElseThrow(ApiException::missing);
      if (!review.getBathroomId().equals(bathroomId) || review.getPhotoOnly() || bathroom.getStatus() != Status.APPROVED) throw ApiException.missing();
      parent = review;
      urls = review.getImageUrls();
    } else {
      if (!registrationAttachment) throw new ApiException(HttpStatus.BAD_REQUEST, "Envie fotos junto com o cadastro de um banheiro ou uma avaliação. Fotos avulsas não são permitidas.");
      parent = bathroom;
      urls = bathroom.getImageUrls();
    }
    if (!parent.getAuthorId().equals(authorId)) throw ApiException.missing();
    byte[] data = sanitize(file);
    if (parent.getStatus() != Status.PENDING) throw new ApiException(HttpStatus.CONFLICT, "O conteúdo já foi analisado. Edite e reenvie antes de anexar fotos.");
    if (urls.size() >= 10) throw new ApiException(HttpStatus.BAD_REQUEST, "Limite de 10 fotos por cadastro ou avaliação.");
    entityManager.lock(parent, LockModeType.OPTIMISTIC_FORCE_INCREMENT);
    UUID imageId = UUID.randomUUID();
    storage.put(imageId, data);
    if (TransactionSynchronizationManager.isSynchronizationActive()) TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
      @Override
      public void afterCompletion(int status) {
        if (status != STATUS_COMMITTED) storage.delete(imageId);
      }
    });
    urls.add(ImageUrls.url(imageId));
    return content.contribution(parent);
  }

  private byte[] sanitize(MultipartFile file) {
    if (file.isEmpty() || file.getSize() > 5 * 1024 * 1024) throw invalid();
    try (var stream = ImageIO.createImageInputStream(file.getInputStream())) {
      var readers = ImageIO.getImageReaders(stream);
      if (!readers.hasNext()) throw invalid();
      var reader = readers.next();
      try {
        String format = reader.getFormatName().toLowerCase(Locale.ROOT);
        if (!Set.of("jpeg", "jpg", "png").contains(format)) throw invalid();
        reader.setInput(stream, true, true);
        int width = reader.getWidth(0),
          height = reader.getHeight(0);
        if (width <= 0 || height <= 0 || width > 6000 || height > 6000 || (long) width * height > 12000000) throw invalid();
        BufferedImage decoded = reader.read(0);
        var clean = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        var graphics = clean.createGraphics();
        graphics.setColor(java.awt.Color.WHITE);
        graphics.fillRect(0, 0, width, height);
        graphics.drawImage(decoded, 0, 0, null);
        graphics.dispose();
        var output = new ByteArrayOutputStream();
        ImageIO.write(clean, "jpg", output);
        return output.toByteArray();
      } finally {
        reader.dispose();
      }
    } catch (IOException exception) {
      throw invalid();
    }
  }

  private ApiException invalid() {
    return new ApiException(HttpStatus.BAD_REQUEST, "Envie uma imagem JPG ou PNG válida, até 5 MB e 12 megapixels.");
  }

  public byte[] read(UUID id, User user) {
    String url = ImageUrls.url(id);
    for (var bathroom : bathrooms.findImageOwners("%" + url + "%")) {
      if (bathroom.getImageUrls().contains(url) && visible(bathroom, user, true)) return storage.read(id);
    }
    for (var review : reviews.findImageOwners("%" + url + "%")) {
      boolean bathroomApproved = bathrooms.findById(review.getBathroomId()).filter(value -> value.getStatus() == Status.APPROVED).isPresent();
      if (review.getImageUrls().contains(url) && visible(review, user, bathroomApproved)) return storage.read(id);
    }
    throw ApiException.missing();
  }

  private boolean visible(br.com.khki.shared.domain.ModeratedContent parent, User user, boolean parentApproved) {
    if (parent.getStatus() == Status.REMOVED) return false;
    return parentApproved && parent.getStatus() == Status.APPROVED || user != null && (user.getRole().equals("ADMIN") || user.getId().equals(parent.getAuthorId()));
  }
}
