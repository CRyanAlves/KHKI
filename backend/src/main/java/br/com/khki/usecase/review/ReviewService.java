package br.com.khki.usecase.review;

import br.com.khki.shared.api.ApiException;
import br.com.khki.shared.api.Contracts.*;
import br.com.khki.shared.domain.Status;
import br.com.khki.usecase.account.UserRepository;
import br.com.khki.usecase.bathroom.BathroomService;
import br.com.khki.usecase.contribution.ContributionService;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class ReviewService {

  private final ReviewRepository reviews;
  private final UserRepository users;
  private final BathroomService bathrooms;
  private final ContributionService contributions;

  public ReviewService(ReviewRepository reviews, UserRepository users, BathroomService bathrooms, ContributionService contributions) {
    this.reviews = reviews;
    this.users = users;
    this.bathrooms = bathrooms;
    this.contributions = contributions;
  }

  public List<ReviewView> publicReviews(UUID id) {
    bathrooms.approved(id);
    return reviews
      .findByBathroomIdAndStatusOrderByCreatedAtDesc(id, Status.APPROVED)
      .stream()
      .filter(review -> !review.getPhotoOnly())
      .map(review -> new ReviewView(review.getId(), users.findById(review.getAuthorId()).orElseThrow().getName(), review.getCleanliness(), review.getStructure(), review.getComment(), review.getCreatedAt()))
      .toList();
  }

  public ContributionView createReview(UUID bathroomId, ReviewInput input, UUID authorId) {
    bathrooms.approved(bathroomId);
    var review = new Review();
    review.setAuthorId(authorId);
    review.setBathroomId(bathroomId);
    applyReview(review, input);
    return contributions.contribution(reviews.save(review));
  }

  private void applyReview(Review review, ReviewInput input) {
    review.setCleanliness(input.cleanliness());
    review.setStructure(input.structure());
    review.setComment(input.comment());
  }

  public ContributionView reviseReview(UUID id, ReviewInput input, UUID authorId) {
    var review = reviews.findById(id).orElseThrow(ApiException::missing);
    contributions.editable(review, authorId);
    bathrooms.approved(review.getBathroomId());
    review.setPhotoOnly(false);
    applyReview(review, input);
    review.setStatus(Status.PENDING);
    review.setReason(null);
    return contributions.contribution(reviews.save(review));
  }
}
