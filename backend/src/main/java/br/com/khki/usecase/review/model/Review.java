package br.com.khki.usecase.review.model;

import br.com.khki.shared.domain.BaseModeratedEntity;
import br.com.khki.usecase.bathroom.model.Bathroom;
import jakarta.persistence.*;

@Entity
@Table(name = "reviews")
public class Review extends BaseModeratedEntity {

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "bathroom_id", nullable = false)
  @com.fasterxml.jackson.annotation.JsonIgnore
  private Bathroom bathroom;

  private Integer cleanliness;
  private Integer structure;

  @Column(nullable = false)
  private boolean photoOnly;

  @Column(length = 1500)
  private String comment;

  public Bathroom getBathroom() {
    return bathroom;
  }

  public void setBathroom(Bathroom value) {
    bathroom = value;
  }

  public Integer getCleanliness() {
    return cleanliness;
  }

  public void setCleanliness(Integer value) {
    cleanliness = value;
  }

  public Integer getStructure() {
    return structure;
  }

  public void setStructure(Integer value) {
    structure = value;
  }

  public boolean getPhotoOnly() {
    return photoOnly;
  }

  public void setPhotoOnly(boolean value) {
    photoOnly = value;
  }

  public String getComment() {
    return comment;
  }

  public void setComment(String value) {
    comment = value;
  }
}
