package br.com.khki.domain;

import java.util.UUID;

/** Projeção de compatibilidade da API /photos. Não possui @Entity nem tabela própria. */
public final class ImageContribution extends ModeratedContent {
  private UUID bathroomId;
  private UUID reviewId;
  private UUID ownerReviewId;
  private boolean registrationAttachment;
  private String url;

  public UUID getBathroomId() { return bathroomId; }
  public void setBathroomId(UUID value) { bathroomId = value; }

  public UUID getReviewId() { return reviewId; }
  public void setReviewId(UUID value) { reviewId = value; }

  public boolean getRegistrationAttachment() { return registrationAttachment; }
  public void setRegistrationAttachment(boolean value) { registrationAttachment = value; }

  public String getUrl() { return url; }
  public void setUrl(String value) { url = value; }
  public UUID getOwnerReviewId() { return ownerReviewId; }
  public void setOwnerReviewId(UUID value) { ownerReviewId = value; }
}
