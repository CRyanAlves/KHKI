package br.com.khki.repository;

import br.com.khki.api.ApiException;
import br.com.khki.domain.*;
import jakarta.persistence.*;
import java.util.*;
import java.util.function.Predicate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

/** Consulta coleções de URLs, sem persistir uma entidade Foto. */
@Repository
@Transactional
public class ImageRepository {
  private final EntityManager entityManager;

  public ImageRepository(EntityManager entityManager) {
    this.entityManager = entityManager;
  }

  public Optional<ImageContribution> findById(UUID id) {
    var bathrooms = entityManager.createQuery("select distinct b from Bathroom b join fetch b.images where exists (select 1 from Bathroom bx join bx.images ix where bx.id = b.id and ix.id = :id)", Bathroom.class).setParameter("id", id).getResultList();
    for (var parent : bathrooms) for (var image : parent.getImages()) if (image != null && image.getId().equals(id)) return Optional.of(view(parent, null, image));
    var reviews = entityManager.createQuery("select distinct r from Review r join fetch r.images where exists (select 1 from Review rx join rx.images ix where rx.id = r.id and ix.id = :id)", Review.class).setParameter("id", id).getResultList();
    for (var parent : reviews) for (var image : parent.getImages()) if (image != null && image.getId().equals(id)) return Optional.of(view(parent, parent.getBathroomId(), image));
    return Optional.empty();
  }

  public List<ImageContribution> findByBathroomIdAndStatus(UUID bathroomId, Status status) {
    return byBathroom(bathroomId).stream().filter(image -> image.getStatus() == status).toList();
  }

  public List<ImageContribution> findByBathroomIdAndStatusNotOrderByCreatedAtDesc(UUID bathroomId, Status status) {
    return byBathroom(bathroomId).stream().filter(image -> image.getStatus() != status).sorted(Comparator.comparing((ImageContribution image) -> image.getCreatedAt()).reversed()).toList();
  }

  public List<ImageContribution> findByStatus(Status status) {
    return matching(image -> image.getStatus() == status, null);
  }

  public List<ImageContribution> findByStatusAndReviewIdIsNullAndRegistrationAttachmentFalse(Status status) {
    return matching(image -> image.getStatus() == status && !image.getRegistrationAttachment() && image.getReviewId() == null, null);
  }

  public List<ImageContribution> findByAuthorIdOrderByCreatedAtDesc(UUID authorId) {
    return matching(image -> image.getAuthorId().equals(authorId), null).stream().sorted(Comparator.comparing((ImageContribution image) -> image.getCreatedAt()).reversed()).toList();
  }

  private List<ImageContribution> byBathroom(UUID id) {
    return matching(image -> true, id);
  }

  private List<ImageContribution> matching(Predicate<ImageContribution> filter, UUID bathroomId) {
    String bathroomQuery = "select distinct b from Bathroom b join fetch b.images" + (bathroomId == null ? "" : " where b.id = :id");
    String reviewQuery = "select distinct r from Review r join fetch r.images" + (bathroomId == null ? "" : " where r.bathroomId = :id");
    var bathroomRows = entityManager.createQuery(bathroomQuery, Bathroom.class);
    var reviewRows = entityManager.createQuery(reviewQuery, Review.class);
    if (bathroomId != null) {
      bathroomRows.setParameter("id", bathroomId);
      reviewRows.setParameter("id", bathroomId);
    }
    var result = new ArrayList<ImageContribution>();
    for (var parent : bathroomRows.getResultList()) for (var image : parent.getImages()) result.add(view(parent, null, image));
    for (var parent : reviewRows.getResultList()) for (var image : parent.getImages()) result.add(view(parent, parent.getBathroomId(), image));
    return result.stream().filter(filter).toList();
  }

  private ImageContribution view(ModeratedContent parent, UUID bathroomId, ImageReference image) {
    var result = new ImageContribution();
    result.setId(image.getId());
    result.setAuthorId(parent.getAuthorId());
    result.setBathroomId(bathroomId == null ? parent.getId() : bathroomId);
    result.setOwnerReviewId(parent instanceof Review ? parent.getId() : null);
    result.setReviewId(parent instanceof Review review && !review.getPhotoOnly() ? parent.getId() : null);
    result.setRegistrationAttachment(parent instanceof Bathroom);
    result.setStatus(image.getStatus());
    result.setReason(image.getReason());
    result.setCreatedAt(image.getCreatedAt());
    result.setVersion(image.getVersion());
    result.setUrl(image.getUrl());
    return result;
  }

  public ImageContribution save(ImageContribution value) {
    if (value.getUrl() == null || !value.getUrl().equals("/api/photos/" + value.getId())) throw new IllegalArgumentException("Referência de imagem inválida.");
    ModeratedContent parent;
    List<ImageReference> images;
    if (value.getRegistrationAttachment()) {
      var bathroom = entityManager.find(Bathroom.class, value.getBathroomId());
      if (bathroom == null) throw ApiException.missing();
      parent = bathroom;
      images = bathroom.getImages();
    } else {
      Review review;
      if (value.getReviewId() != null) review = entityManager.find(Review.class, value.getReviewId());
      else {
        var owners = entityManager.createQuery("select r from Review r join r.images i where i.id = :id", Review.class).setParameter("id", value.getId()).getResultList();
        review = owners.isEmpty() ? null : owners.get(0);
        if (review == null) {
          review = new Review();
          review.setId(value.getId());
          review.setAuthorId(value.getAuthorId());
          review.setBathroomId(value.getBathroomId());
          review.setPhotoOnly(true);
          review.setCreatedAt(value.getCreatedAt());
          review.setStatus(value.getStatus());
          entityManager.persist(review);
        }
      }
      if (review == null || !review.getAuthorId().equals(value.getAuthorId()) || !review.getBathroomId().equals(value.getBathroomId())) throw ApiException.missing();
      if (review.getPhotoOnly()) {
        review.setStatus(value.getStatus());
        review.setReason(value.getReason());
      }
      parent = review;
      images = review.getImages();
    }
    var reference = images.stream().filter(image -> image.getId().equals(value.getId())).findFirst().orElse(null);
    if (reference == null) {
      reference = new ImageReference();
      reference.setId(value.getId());
      reference.setCreatedAt(value.getCreatedAt());
      images.add(reference);
    } else reference.setVersion(reference.getVersion() + 1);
    reference.setUrl(value.getUrl());
    reference.setStatus(value.getStatus());
    reference.setReason(value.getReason());
    if (parent.getVersion() > 0) entityManager.lock(parent, LockModeType.OPTIMISTIC_FORCE_INCREMENT);
    return value;
  }
}
