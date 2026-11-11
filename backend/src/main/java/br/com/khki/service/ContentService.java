package br.com.khki.service;

import br.com.khki.api.*;
import br.com.khki.api.Contracts.*;
import br.com.khki.domain.*;
import br.com.khki.repository.*;
import java.text.Normalizer;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class ContentService {

  private final BathroomRepository bathrooms;
  private final ReviewRepository reviews;
  private final ImageRepository photos;
  private final AppUserRepository users;
  private final SubmissionService submissions;

  public ContentService(BathroomRepository bathrooms, ReviewRepository reviews, ImageRepository photos, AppUserRepository users, SubmissionService submissions) {
    this.bathrooms = bathrooms;
    this.reviews = reviews;
    this.photos = photos;
    this.users = users;
    this.submissions = submissions;
  }

  public Bathroom approved(UUID id) {
    return bathrooms
      .findById(id)
      .filter(value -> value.getStatus() == Status.APPROVED)
      .orElseThrow(ApiException::missing);
  }

  private String normalize(String value) {
    return Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT);
  }

  public List<BathroomView> search(String query, Access access, Boolean accessible) {
    return search(query, access, accessible, 0);
  }

  public List<BathroomView> search(String query, Access access, Boolean accessible, int offset) {
    String term = normalize(query);
    return bathrooms
      .findByStatus(Status.APPROVED)
      .stream()
      .filter(value -> normalize(value.getName() + " " + value.getAddress()).contains(term))
      .filter(value -> access == null || value.getAccess() == access)
      .filter(value -> accessible == null || accessible.equals(value.getAccessible()))
      .sorted(Comparator.comparing((Bathroom value) -> value.getName()).thenComparing(value -> value.getId()))
      .skip(offset)
      .limit(200)
      .map(this::view)
      .toList();
  }

  public BathroomView view(Bathroom bathroom) {
    bathroom = bathrooms.findById(bathroom.getId()).orElseThrow(ApiException::missing);
    var approvedReviews = reviews.findByBathroomIdAndStatusOrderByCreatedAtDesc(bathroom.getId(), Status.APPROVED).stream().filter(review -> !review.getPhotoOnly()).toList();
    Double average = approvedReviews.isEmpty()
      ? null
      : approvedReviews
          .stream()
          .mapToDouble(review -> (review.getCleanliness() + review.getStructure()) / 2.0)
          .average()
          .orElseThrow();
    return new BathroomView(
      bathroom.getId(),
      bathroom.getName(),
      bathroom.getAddress(),
      bathroom.getCategory(),
      bathroom.getLatitude(),
      bathroom.getLongitude(),
      bathroom.getAccess(),
      bathroom.getAccessDetails(),
      bathroom.getHours(),
      bathroom.getAccessible(),
      List.copyOf(bathroom.getItems()),
      average,
      approvedReviews.size(),
      photos
        .findByBathroomIdAndStatus(bathroom.getId(), Status.APPROVED)
        .stream()
        .filter(this::parentVisible)
        .map(photo -> photo.getId())
        .toList(),
      bathroom.getDemo(),
      bathroom.getComplement(),
      BathroomDetailsMapper.view(bathroom)
    );
  }

  public List<ReviewView> publicReviews(UUID id) {
    approved(id);
    return reviews
      .findByBathroomIdAndStatusOrderByCreatedAtDesc(id, Status.APPROVED)
      .stream()
      .filter(review -> !review.getPhotoOnly())
      .map(review -> new ReviewView(review.getId(), users.findById(review.getAuthorId()).orElseThrow().getName(), review.getCleanliness(), review.getStructure(), review.getComment(), review.getCreatedAt()))
      .toList();
  }

  public ContributionView createBathroom(BathroomInput input, UUID authorId) {
    String fingerprint = submissions.fingerprint(input);
    UUID previous = submissions.replay(input.submissionId(), authorId, "BATHROOM_CREATE", fingerprint);
    if (previous != null) return contribution(target(TargetType.BATHROOM, previous));
    var bathroom = new Bathroom();
    bathroom.setAuthorId(authorId);
    apply(bathroom, input);
    bathrooms.save(bathroom);
    submissions.remember(input.submissionId(), authorId, "BATHROOM_CREATE", fingerprint, TargetType.BATHROOM, bathroom.getId());
    return contribution(bathroom);
  }

  public ContributionView reviseBathroom(UUID id, BathroomInput input, UUID authorId) {
    var bathroom = bathrooms.findById(id).orElseThrow(ApiException::missing);
    String operation = "BATHROOM_EDIT:" + id;
    String fingerprint = submissions.fingerprint(input);
    UUID previous = submissions.replay(input.submissionId(), authorId, operation, fingerprint);
    if (previous != null) return contribution(target(TargetType.BATHROOM, previous));
    editable(bathroom, authorId);
    apply(bathroom, input);
    bathroom.setStatus(Status.PENDING);
    bathroom.setReason(null);
    bathrooms.save(bathroom);
    submissions.remember(input.submissionId(), authorId, operation, fingerprint, TargetType.BATHROOM, id);
    return contribution(bathroom);
  }

  public ContributionView submission(UUID key, UUID authorId) {
    var receipt = submissions.own(key, authorId);
    return contribution(target(receipt.getTargetType(), receipt.getTargetId()));
  }

  private void apply(Bathroom bathroom, BathroomInput input) {
    bathroom.setName(input.name().strip());
    bathroom.setAddress(input.address().strip());
    bathroom.setComplement(input.complement() == null ? null : input.complement().strip());
    bathroom.setCategory(input.category().strip());
    bathroom.setLatitude(input.latitude());
    bathroom.setLongitude(input.longitude());
    bathroom.setAccess(input.access());
    bathroom.setAccessDetails(input.accessDetails());
    bathroom.setHours(input.hours());
    bathroom.setAccessible(input.accessible());
    bathroom.setItems(new TreeSet<>(input.items()));
    BathroomDetailsMapper.apply(bathroom, input.details());
  }

  private void editable(ModeratedContent content, UUID authorId) {
    if (!content.getAuthorId().equals(authorId) || (content.getStatus() != Status.REJECTED && content.getStatus() != Status.NEEDS_INFORMATION)) throw new ApiException(HttpStatus.FORBIDDEN, "Somente o autor pode reenviar uma contribuição rejeitada ou com solicitação de informações.");
  }

  public String authorName(UUID id) {
    return users
      .findById(id)
      .map(user -> user.getName())
      .orElse("Autor indisponível");
  }

  public ContributionView createReview(UUID bathroomId, ReviewInput input, UUID authorId) {
    approved(bathroomId);
    var review = new Review();
    review.setAuthorId(authorId);
    review.setBathroomId(bathroomId);
    applyReview(review, input);
    return contribution(reviews.save(review));
  }

  private void applyReview(Review review, ReviewInput input) {
    review.setCleanliness(input.cleanliness());
    review.setStructure(input.structure());
    review.setComment(input.comment());
  }

  public ContributionView reviseReview(UUID id, ReviewInput input, UUID authorId) {
    var review = reviews.findById(id).orElseThrow(ApiException::missing);
    editable(review, authorId);
    approved(review.getBathroomId());
    if (review.getPhotoOnly()) throw new ApiException(HttpStatus.BAD_REQUEST, "Este envio contém somente fotos.");
    applyReview(review, input);
    review.setStatus(Status.PENDING);
    review.setReason(null);
    return contribution(reviews.save(review));
  }

  public List<BathroomView> duplicates(String name, double latitude, double longitude) {
    return bathrooms
      .findByStatus(Status.APPROVED)
      .stream()
      .filter(value -> distance(latitude, longitude, value.getLatitude(), value.getLongitude()) < 150 && normalize(value.getName()).contains(normalize(name)))
      .limit(5)
      .map(this::view)
      .toList();
  }

  private double distance(double latitude, double longitude, double otherLatitude, double otherLongitude) {
    double deltaLatitude = Math.toRadians(otherLatitude - latitude),
      deltaLongitude = Math.toRadians(otherLongitude - longitude);
    double haversine = Math.pow(Math.sin(deltaLatitude / 2), 2) + Math.cos(Math.toRadians(latitude)) * Math.cos(Math.toRadians(otherLatitude)) * Math.pow(Math.sin(deltaLongitude / 2), 2);
    return 6371000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  }

  public boolean parentVisible(ImageContribution photo) {
    return (
      bathrooms
        .findById(photo.getBathroomId())
        .filter(value -> value.getStatus() == Status.APPROVED)
        .isPresent() &&
      (photo.getOwnerReviewId() == null ||
        reviews
          .findById(photo.getOwnerReviewId())
          .filter(value -> value.getStatus() == Status.APPROVED)
          .isPresent())
    );
  }

  public ContributionView contribution(ModeratedContent content) {
    TargetType type = content instanceof Bathroom ? TargetType.BATHROOM : content instanceof Review ? TargetType.REVIEW : TargetType.PHOTO;
    UUID bathroomId = content instanceof Bathroom ? content.getId() : content instanceof Review review ? review.getBathroomId() : ((ImageContribution) content).getBathroomId();
    String title =
      content instanceof Bathroom bathroom
        ? bathroom.getName()
        : (type == TargetType.REVIEW ? "Avaliação: " : "Foto: ") +
          bathrooms
            .findById(bathroomId)
            .map(value -> value.getName())
            .orElse("Banheiro");
    return new ContributionView(content.getId(), type, title, content.getStatus(), content.getReason(), content.getCreatedAt(), bathroomId);
  }

  public List<ContributionView> mine(UUID authorId) {
    var result = new ArrayList<ContributionView>();
    bathrooms.findByAuthorIdOrderByCreatedAtDesc(authorId).forEach(value -> result.add(contribution(value)));
    reviews.findByAuthorIdOrderByCreatedAtDesc(authorId).stream().filter(review -> !review.getPhotoOnly()).forEach(value -> result.add(contribution(value)));
    photos.findByAuthorIdOrderByCreatedAtDesc(authorId).forEach(value -> result.add(contribution(value)));
    result.sort(Comparator.comparing(ContributionView::createdAt).reversed());
    return result;
  }

  public ModeratedContent target(TargetType type, UUID id) {
    return switch (type) {
      case BATHROOM -> bathrooms.findById(id).orElseThrow(ApiException::missing);
      case REVIEW -> reviews.findById(id).filter(review -> !review.getPhotoOnly()).orElseThrow(ApiException::missing);
      case PHOTO -> photos.findById(id).orElseThrow(ApiException::missing);
    };
  }

  public ContentReference reference(TargetType type, UUID id) {
    return ContentReference.of(type, id, type == TargetType.PHOTO && ((ImageContribution) target(type, id)).getRegistrationAttachment());
  }

  public void requirePublic(TargetType type, UUID id) {
    var content = target(type, id);
    if (content.getStatus() != Status.APPROVED) throw ApiException.missing();
    if (content instanceof Review review) approved(review.getBathroomId());
    if (content instanceof ImageContribution photo && !parentVisible(photo)) throw ApiException.missing();
  }
}
