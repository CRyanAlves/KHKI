package br.com.khki.domain;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "reviews")
public class Review extends ModeratedContent {

  @Column(nullable = false)
  public UUID bathroomId;

  public int cleanliness;
  public int structure;

  @Column(length = 1500)
  public String comment;
}
