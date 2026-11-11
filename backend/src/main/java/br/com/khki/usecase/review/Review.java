package br.com.khki.usecase.review;

import br.com.khki.shared.domain.ModeratedContent;
import br.com.khki.usecase.bathroom.Bathroom;
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

  @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
  @Column(name = "image_urls", nullable = false, columnDefinition = "jsonb")
  private List<String> imageUrls = new ArrayList<>();

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

  public List<String> getImageUrls() { return imageUrls; }
  public void setImageUrls(List<String> value) { imageUrls = value; }

  public String getComment() { return comment; }
  public void setComment(String value) { comment = value; }
}
