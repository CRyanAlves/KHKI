package br.com.khki.shared.domain;

import br.com.khki.usecase.bathroom.Bathroom;
import br.com.khki.usecase.review.Review;
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

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "bathroom_target_id", insertable = false, updatable = false)
  @JsonIgnore
  private Bathroom bathroom;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "review_target_id", insertable = false, updatable = false)
  @JsonIgnore
  private Review review;

  public static ContentReference of(TargetType type, UUID id) {
    var value = new ContentReference();
    switch (type) {
      case BATHROOM -> value.bathroomTargetId = id;
      case REVIEW -> value.reviewTargetId = id;
    }
    return value;
  }

  public UUID getBathroomTargetId() { return bathroomTargetId; }
  public void setBathroomTargetId(UUID value) { bathroomTargetId = value; }

  public UUID getReviewTargetId() { return reviewTargetId; }
  public void setReviewTargetId(UUID value) { reviewTargetId = value; }

  public Bathroom getBathroom() { return bathroom; }
  public void setBathroom(Bathroom value) { bathroom = value; }

  public Review getReview() { return review; }
  public void setReview(Review value) { review = value; }
}
