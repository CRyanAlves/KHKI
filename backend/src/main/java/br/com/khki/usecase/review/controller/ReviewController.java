package br.com.khki.usecase.review.controller;

import br.com.khki.usecase.contribution.dto.ContributionDTO;
import br.com.khki.usecase.review.dto.ReviewDTO;
import br.com.khki.usecase.review.dto.ReviewInputDTO;
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
  public List<ReviewDTO> reviews(@PathVariable UUID id) {
    return reviewService.publicReviews(id);
  }

  @PostMapping("/bathrooms/{id}/reviews")
  @ResponseStatus(HttpStatus.CREATED)
  public ContributionDTO review(@PathVariable UUID id, @Valid @RequestBody ReviewInputDTO input, Principal principal) {
    return reviewService.createReview(id, input, accounts.current(principal).getId());
  }

  @PutMapping("/reviews/{id}")
  public ContributionDTO reviseReview(@PathVariable UUID id, @Valid @RequestBody ReviewInputDTO input, Principal principal) {
    return reviewService.reviseReview(id, input, accounts.current(principal).getId());
  }
}
