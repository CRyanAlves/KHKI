package br.com.khki.usecase.contribution;

import br.com.khki.shared.api.ApiException;
import br.com.khki.shared.domain.BaseModeratedEntity;
import br.com.khki.shared.domain.Status;
import br.com.khki.shared.domain.TargetType;
import br.com.khki.usecase.bathroom.Bathroom;
import br.com.khki.usecase.bathroom.BathroomRepository;
import br.com.khki.usecase.contribution.dto.ContributionView;
import br.com.khki.usecase.review.Review;
import br.com.khki.usecase.review.ReviewRepository;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class ContributionService {

  private final BathroomRepository bathrooms;
  private final ReviewRepository reviews;

  public ContributionService(BathroomRepository bathrooms, ReviewRepository reviews) {
    this.bathrooms = bathrooms;
    this.reviews = reviews;
  }

  public void editable(BaseModeratedEntity content, UUID authorId) {
    if (!content.getAuthor().getId().equals(authorId) || (content.getStatus() != Status.REJECTED && content.getStatus() != Status.NEEDS_INFORMATION)) throw new ApiException(HttpStatus.FORBIDDEN, "Somente o autor pode reenviar uma contribuição rejeitada ou com solicitação de informações.");
  }

  public ContributionView contribution(BaseModeratedEntity content) {
    TargetType type = content instanceof Bathroom ? TargetType.BATHROOM : TargetType.REVIEW;
    var bathroom = bathroom(content);
    UUID bathroomId = bathroom.getId();
    String title = content instanceof Bathroom ? bathroom.getName() : "Avaliação: " + bathroom.getName();
    return new ContributionView(content.getId(), type, title, content.getStatus(), content.getReason(), content.getCreatedAt(), bathroomId);
  }

  public List<ContributionView> mine(UUID authorId) {
    var result = new ArrayList<ContributionView>();
    bathrooms.findByAuthor_IdOrderByCreatedAtDesc(authorId).forEach(value -> result.add(contribution(value)));
    reviews.findByAuthor_IdOrderByCreatedAtDesc(authorId).forEach(value -> result.add(contribution(value)));
    result.sort(Comparator.comparing(ContributionView::createdAt).reversed());
    return result;
  }

  public BaseModeratedEntity target(TargetType type, UUID id) {
    return switch (type) {
      case BATHROOM -> bathrooms.findById(id).orElseThrow(ApiException::missing);
      case REVIEW -> reviews.findById(id).orElseThrow(ApiException::missing);
    };
  }

  public Bathroom bathroom(BaseModeratedEntity target) {
    return target instanceof Bathroom bathroom ? bathroom : ((Review) target).getBathroom();
  }

  public BaseModeratedEntity requirePublic(TargetType type, UUID id) {
    var content = target(type, id);
    if (content.getStatus() != Status.APPROVED || (content instanceof Review review && review.getBathroom().getStatus() != Status.APPROVED)) throw ApiException.missing();
    return content;
  }
}
