package br.com.khki.usecase.contribution;

import br.com.khki.shared.api.ApiException;
import br.com.khki.shared.api.Contracts.*;
import br.com.khki.shared.domain.ContentReference;
import br.com.khki.shared.domain.ModeratedContent;
import br.com.khki.shared.domain.Status;
import br.com.khki.shared.domain.TargetType;
import br.com.khki.usecase.account.UserRepository;
import br.com.khki.usecase.bathroom.Bathroom;
import br.com.khki.usecase.bathroom.BathroomRepository;
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
  private final UserRepository users;

  public ContributionService(BathroomRepository bathrooms, ReviewRepository reviews, UserRepository users) {
    this.bathrooms = bathrooms;
    this.reviews = reviews;
    this.users = users;
  }

  public void editable(ModeratedContent content, UUID authorId) {
    if (!content.getAuthorId().equals(authorId) || (content.getStatus() != Status.REJECTED && content.getStatus() != Status.NEEDS_INFORMATION)) throw new ApiException(HttpStatus.FORBIDDEN, "Somente o autor pode reenviar uma contribuição rejeitada ou com solicitação de informações.");
  }

  public String authorName(UUID id) {
    return users
      .findById(id)
      .map(user -> user.getName())
      .orElse("Autor indisponível");
  }

  public ContributionView contribution(ModeratedContent content) {
    TargetType type = content instanceof Bathroom ? TargetType.BATHROOM : TargetType.REVIEW;
    UUID bathroomId = content instanceof Bathroom ? content.getId() : ((Review) content).getBathroomId();
    String title =
      content instanceof Bathroom bathroom
        ? bathroom.getName()
        : "Avaliação: " +
          bathrooms
            .findById(bathroomId)
            .map(value -> value.getName())
            .orElse("Banheiro");
    return new ContributionView(content.getId(), type, title, content.getStatus(), content.getReason(), content.getCreatedAt(), bathroomId);
  }

  public List<ContributionView> mine(UUID authorId) {
    var result = new ArrayList<ContributionView>();
    bathrooms.findByAuthorIdOrderByCreatedAtDesc(authorId).forEach(value -> result.add(contribution(value)));
    reviews.findByAuthorIdOrderByCreatedAtDesc(authorId).forEach(value -> result.add(contribution(value)));
    result.sort(Comparator.comparing(ContributionView::createdAt).reversed());
    return result;
  }

  public ModeratedContent target(TargetType type, UUID id) {
    return switch (type) {
      case BATHROOM -> bathrooms.findById(id).orElseThrow(ApiException::missing);
      case REVIEW -> reviews.findById(id).orElseThrow(ApiException::missing);
    };
  }

  public ContentReference reference(TargetType type, UUID id) {
    return ContentReference.of(type, id);
  }

  public void requirePublic(TargetType type, UUID id) {
    var content = target(type, id);
    if (content.getStatus() != Status.APPROVED) throw ApiException.missing();
    if (content instanceof Review review && !bathrooms.findById(review.getBathroomId()).filter(value -> value.getStatus() == Status.APPROVED).isPresent()) throw ApiException.missing();
  }
}
