package br.com.khki.usecase.review;

import br.com.khki.shared.api.Contracts.*;
import br.com.khki.usecase.account.AccountService;
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
  private final AccountService accounts;

  public ReviewController(ReviewService reviewService, AccountService accounts) {
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
