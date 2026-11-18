package br.com.khki.usecase.contribution.controller;

import br.com.khki.shared.api.ApiException;
import br.com.khki.shared.domain.TargetType;
import br.com.khki.usecase.bathroom.model.Bathroom;
import br.com.khki.usecase.bathroom.service.BathroomService;
import br.com.khki.usecase.contribution.dto.ContributionDTO;
import br.com.khki.usecase.contribution.service.ContributionService;
import br.com.khki.usecase.review.dto.ReviewDTO;
import br.com.khki.usecase.review.model.Review;
import br.com.khki.usecase.user.service.UserService;
import jakarta.validation.constraints.*;
import java.security.Principal;
import java.util.*;
import org.springframework.http.*;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
@Validated
public class ContributionController {

  private final ContributionService contributionService;
  private final UserService accounts;
  private final BathroomService bathrooms;

  public ContributionController(ContributionService contributionService, UserService accounts, BathroomService bathrooms) {
    this.contributionService = contributionService;
    this.accounts = accounts;
    this.bathrooms = bathrooms;
  }

  @GetMapping("/me/contributions")
  public List<ContributionDTO> mine(Principal principal) {
    return contributionService.mine(accounts.current(principal).getId());
  }

  @GetMapping("/me/contributions/{type}/{id}")
  public Object own(@PathVariable TargetType type, @PathVariable UUID id, Principal principal) {
    var target = contributionService.target(type, id);
    if (!target.getAuthor().getId().equals(accounts.current(principal).getId())) throw ApiException.missing();
    if (target instanceof Bathroom bathroom) return bathrooms.view(bathroom);
    if (target instanceof Review review) return new ReviewDTO(review.getId(), "Sua avaliação", review.getCleanliness(), review.getStructure(), review.getComment(), review.getCreatedAt());
    return contributionService.contribution(target);
  }
}
