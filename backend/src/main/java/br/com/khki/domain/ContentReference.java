package br.com.khki.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.util.UUID;

/** Chaves tipadas permitem ao banco validar os destinos das denúncias e decisões. */
@Embeddable
public class ContentReference {
  @Column(name = "bathroom_target_id")
  private UUID bathroomTargetId;
  @Column(name = "review_target_id")
  private UUID reviewTargetId;
  @Column(name = "bathroom_image_target_id")
  private UUID bathroomImageTargetId;
  @Column(name = "review_image_target_id")
  private UUID reviewImageTargetId;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "bathroom_target_id", insertable = false, updatable = false)
  @JsonIgnore
  private Bathroom bathroom;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "review_target_id", insertable = false, updatable = false)
  @JsonIgnore
  private Review review;

  public static ContentReference of(TargetType type, UUID id, boolean registrationImage) {
    var value = new ContentReference();
    switch (type) {
      case BATHROOM -> value.bathroomTargetId = id;
      case REVIEW -> value.reviewTargetId = id;
      case PHOTO -> {
        if (registrationImage) value.bathroomImageTargetId = id;
        else value.reviewImageTargetId = id;
      }
    }
    return value;
  }

  public UUID getBathroomTargetId() { return bathroomTargetId; }
  public void setBathroomTargetId(UUID value) { bathroomTargetId = value; }

  public UUID getReviewTargetId() { return reviewTargetId; }
  public void setReviewTargetId(UUID value) { reviewTargetId = value; }

  public UUID getBathroomImageTargetId() { return bathroomImageTargetId; }
  public void setBathroomImageTargetId(UUID value) { bathroomImageTargetId = value; }

  public UUID getReviewImageTargetId() { return reviewImageTargetId; }
  public void setReviewImageTargetId(UUID value) { reviewImageTargetId = value; }

  public Bathroom getBathroom() { return bathroom; }
  public void setBathroom(Bathroom value) { bathroom = value; }

  public Review getReview() { return review; }
  public void setReview(Review value) { review = value; }
}
