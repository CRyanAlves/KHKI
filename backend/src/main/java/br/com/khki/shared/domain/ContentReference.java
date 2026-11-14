package br.com.khki.shared.domain;

import br.com.khki.usecase.bathroom.Bathroom;
import br.com.khki.usecase.review.Review;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.util.UUID;

/** Chaves tipadas permitem ao banco validar os destinos das denúncias e decisões. */
@Embeddable
public class ContentReference {
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "bathroom_target_id")
  @JsonIgnore
  private Bathroom bathroom;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "review_target_id")
  @JsonIgnore
  private Review review;

  public static ContentReference of(BaseModeratedEntity target) {
    var reference = new ContentReference();
    if (target instanceof Bathroom bathroom) reference.setBathroom(bathroom);
    else if (target instanceof Review review) reference.setReview(review);
    else throw new IllegalArgumentException("Referência de conteúdo inválida.");
    return reference;
  }

  public Bathroom getBathroom() { return bathroom; }
  public void setBathroom(Bathroom value) { bathroom = value; }

  public Review getReview() { return review; }
  public void setReview(Review value) { review = value; }

  @Transient
  public TargetType getTargetType() { return target() instanceof Bathroom ? TargetType.BATHROOM : TargetType.REVIEW; }

  @Transient
  public UUID getTargetId() { return target().getId(); }

  private BaseModeratedEntity target() {
    if ((bathroom == null) == (review == null)) throw new IllegalStateException("A referência deve apontar para exatamente um banheiro ou uma avaliação.");
    return bathroom != null ? bathroom : review;
  }
}
