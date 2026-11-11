package br.com.khki.domain;

import jakarta.persistence.*;
import java.util.*;

@Entity
@Table(name = "reviews")
public class Review extends ModeratedContent {

  @Column(name = "bathroom_id", nullable = false)
  private UUID bathroomId;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "bathroom_id", insertable = false, updatable = false)
  @com.fasterxml.jackson.annotation.JsonIgnore
  private Bathroom bathroom;

  private Integer cleanliness;
  private Integer structure;

  @Column(nullable = false)
  private boolean photoOnly;

  @ElementCollection(fetch = FetchType.LAZY)
  @CollectionTable(name = "review_images", joinColumns = @JoinColumn(name = "review_id"))
  @OrderColumn(name = "image_order")
  private List<ImageReference> images = new ArrayList<>();

  @Column(length = 1500)
  private String comment;

  public UUID getBathroomId() { return bathroomId; }
  public void setBathroomId(UUID value) { bathroomId = value; }

  public Bathroom getBathroom() { return bathroom; }
  public void setBathroom(Bathroom value) { bathroom = value; }

  public Integer getCleanliness() { return cleanliness; }
  public void setCleanliness(Integer value) { cleanliness = value; }

  public Integer getStructure() { return structure; }
  public void setStructure(Integer value) { structure = value; }

  public boolean getPhotoOnly() { return photoOnly; }
  public void setPhotoOnly(boolean value) { photoOnly = value; }

  public List<ImageReference> getImages() { return images; }
  public void setImages(List<ImageReference> value) { images = value; }

  public String getComment() { return comment; }
  public void setComment(String value) { comment = value; }
}
