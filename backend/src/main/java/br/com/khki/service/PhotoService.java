package br.com.khki.service;

import br.com.khki.api.*;
import br.com.khki.api.Contracts.ContributionView;
import br.com.khki.domain.*;
import br.com.khki.repository.*;
import br.com.khki.storage.ImageStorage;
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
public class PhotoService {

  private final ImageRepository photos;
  private final BathroomRepository bathrooms;
  private final ReviewRepository reviews;
  private final ContentService content;
  private final SubmissionService submissions;
  private final EntityManager entityManager;
  private final ImageStorage storage;

  public PhotoService(ImageRepository photos, BathroomRepository bathrooms, ReviewRepository reviews, ContentService content, SubmissionService submissions, EntityManager entityManager, ImageStorage storage) {
    this.photos = photos;
    this.bathrooms = bathrooms;
    this.reviews = reviews;
    this.content = content;
    this.submissions = submissions;
    this.entityManager = entityManager;
    this.storage = storage;
  }

  public ContributionView upload(UUID bathroomId, UUID reviewId, UUID authorId, MultipartFile file, UUID submissionId, boolean registrationAttachment) {
    if (registrationAttachment && reviewId != null) throw new ApiException(HttpStatus.BAD_REQUEST, "Escolha apenas um vínculo para a foto.");
    byte[] data = sanitize(file);
    String fingerprint = submissions.fingerprint(List.of(bathroomId.toString(), reviewId == null ? "" : reviewId.toString(), submissions.digest(data)));
    UUID previous = submissions.replay(submissionId, authorId, "PHOTO_UPLOAD", fingerprint);
    if (previous != null) return content.contribution(content.target(TargetType.PHOTO, previous));
    var bathroom = bathrooms.findById(bathroomId).orElseThrow(ApiException::missing);
    if (bathroom.getStatus() != Status.APPROVED && !(bathroom.getStatus() == Status.PENDING && bathroom.getAuthorId().equals(authorId))) throw ApiException.missing();
    boolean attachedToRegistration = reviewId == null && bathroom.getStatus() == Status.PENDING && bathroom.getAuthorId().equals(authorId);
    if (registrationAttachment && !attachedToRegistration) throw new ApiException(HttpStatus.CONFLICT, "O cadastro já foi analisado. Envie novas fotos pela opção Adicionar foto do banheiro.");
    if (reviewId != null) {
      var review = reviews.findById(reviewId).orElseThrow(ApiException::missing);
      if (!review.getAuthorId().equals(authorId) || !review.getBathroomId().equals(bathroomId) || review.getStatus() != Status.PENDING) throw ApiException.missing();
      entityManager.lock(review, LockModeType.OPTIMISTIC_FORCE_INCREMENT);
    } else if (attachedToRegistration) entityManager.lock(bathroom, LockModeType.OPTIMISTIC_FORCE_INCREMENT);
    if (
      photos
        .findByAuthorIdOrderByCreatedAtDesc(authorId)
        .stream()
        .filter(photo -> photo.getBathroomId().equals(bathroomId) && photo.getStatus() != Status.REMOVED)
        .count() >= 10
    ) throw new ApiException(HttpStatus.BAD_REQUEST, "Limite de 10 fotos por autor e banheiro.");
    var photo = new ImageContribution();
    photo.setBathroomId(bathroomId);
    photo.setReviewId(reviewId);
    photo.setRegistrationAttachment(attachedToRegistration);
    photo.setAuthorId(authorId);
    photo.setUrl("/api/photos/" + photo.getId());
    storage.put(photo.getId(), data);
    if (TransactionSynchronizationManager.isSynchronizationActive()) TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
      @Override
      public void afterCompletion(int status) {
        if (status != STATUS_COMMITTED) storage.delete(photo.getId());
      }
    });
    photos.save(photo);
    submissions.remember(submissionId, authorId, "PHOTO_UPLOAD", fingerprint, TargetType.PHOTO, photo.getId());
    return content.contribution(photo);
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

  public byte[] read(UUID id, AppUser user) {
    var photo = photos.findById(id).orElseThrow(ApiException::missing);
    boolean published = photo.getStatus() == Status.APPROVED && content.parentVisible(photo);
    boolean privileged = user != null && (user.getRole().equals("ADMIN") || user.getId().equals(photo.getAuthorId()));
    if (!published && !privileged) throw ApiException.missing();
    if (photo.getStatus() == Status.REMOVED) throw ApiException.missing();
    return storage.read(id);
  }
}
