package br.com.khki.usecase.review.controller;

import br.com.khki.usecase.contribution.dto.ContributionView;
import br.com.khki.usecase.review.dto.ReviewInput;
import br.com.khki.usecase.review.dto.ReviewView;
import br.com.khki.usecase.review.service.ReviewService;
import br.com.khki.usecase.user.service.UserService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.security.Principal;
import java.util.*;
import org.springframework.http.*;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
@Validated
public class ReviewController {

  private final ReviewService reviewService;
  private final UserService accounts;

  public ReviewController(ReviewService reviewService, UserService accounts) {
    this.reviewService = reviewService;
    this.accounts = accounts;
  }

  @GetMapping("/bathrooms/{id}/reviews")
  public List<ReviewView> reviews(@PathVariable UUID id) {
    return reviewService.publicReviews(id);
  }

  @PostMapping("/bathrooms/{id}/reviews")
  @ResponseStatus(HttpStatus.CREATED)
  public ContributionView review(@PathVariable UUID id, @Valid @RequestBody ReviewInput input, Principal principal) {
    return reviewService.createReview(id, input, accounts.current(principal).getId());
  }

  @PutMapping("/reviews/{id}")
  public ContributionView reviseReview(@PathVariable UUID id, @Valid @RequestBody ReviewInput input, Principal principal) {
    return reviewService.reviseReview(id, input, accounts.current(principal).getId());
  }
}
