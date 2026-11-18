package br.com.khki.usecase.bathroom.service;

import br.com.khki.shared.api.ApiException;
import br.com.khki.shared.domain.GeographicDistance;
import br.com.khki.shared.domain.Status;
import br.com.khki.usecase.bathroom.dto.BathroomInput;
import br.com.khki.usecase.bathroom.dto.BathroomView;
import br.com.khki.usecase.bathroom.model.AccessType;
import br.com.khki.usecase.bathroom.model.Bathroom;
import br.com.khki.usecase.bathroom.model.repository.BathroomRepository;
import br.com.khki.usecase.contribution.dto.ContributionView;
import br.com.khki.usecase.contribution.service.ContributionService;
import br.com.khki.usecase.image.service.ImageUrls;
import br.com.khki.usecase.review.model.repository.ReviewRepository;
import br.com.khki.usecase.user.model.repository.UserRepository;
import java.text.Normalizer;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class BathroomService {

  private final BathroomRepository bathrooms;
  private final ReviewRepository reviews;
  private final UserRepository users;
  private final ContributionService contributions;

  public BathroomService(BathroomRepository bathrooms, ReviewRepository reviews, ContributionService contributions, UserRepository users) {
    this.bathrooms = bathrooms;
    this.reviews = reviews;
    this.users = users;
    this.contributions = contributions;
  }

  public Bathroom approved(UUID id) {
    return bathrooms
      .findById(id)
      .filter(value -> value.getStatus() == Status.APPROVED)
      .orElseThrow(ApiException::missing);
  }

  private String normalize(String value) {
    return Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT);
  }

  public List<BathroomView> search(String query, AccessType access, Boolean accessible, int offset) {
    String term = normalize(query);
    return bathrooms
      .findByStatus(Status.APPROVED)
      .stream()
      .filter(value -> normalize(value.getName() + " " + value.getAddress()).contains(term))
      .filter(value -> access == null || value.getAccess() == access)
      .filter(value -> accessible == null || accessible.equals(value.getAccessible()))
      .sorted(Comparator.comparing((Bathroom value) -> value.getName()).thenComparing(value -> value.getId()))
      .skip(offset)
      .limit(200)
      .map(this::view)
      .toList();
  }

  public BathroomView view(Bathroom bathroom) {
    bathroom = bathrooms.findById(bathroom.getId()).orElseThrow(ApiException::missing);
    var publicReviews = reviews.findByBathroom_IdAndStatusOrderByCreatedAtDesc(bathroom.getId(), Status.APPROVED);
    var approvedReviews = publicReviews
      .stream()
      .filter(review -> !review.getPhotoOnly())
      .toList();
    Double average = approvedReviews.isEmpty()
      ? null
      : approvedReviews
          .stream()
          .mapToDouble(review -> (review.getCleanliness() + review.getStructure()) / 2.0)
          .average()
          .orElseThrow();
    return new BathroomView(
      bathroom.getId(),
      bathroom.getName(),
      bathroom.getAddress(),
      bathroom.getCategory(),
      bathroom.getLatitude(),
      bathroom.getLongitude(),
      bathroom.getAccess(),
      bathroom.getAccessDetails(),
      bathroom.getHours(),
      bathroom.getAccessible(),
      List.copyOf(bathroom.getItems()),
      average,
      approvedReviews.size(),
      java.util.stream.Stream.concat(bathroom.getImageUrls().stream(), publicReviews.stream().flatMap(review -> review.getImageUrls().stream()))
        .map(ImageUrls::id)
        .distinct()
        .toList(),
      bathroom.getDemo(),
      bathroom.getComplement(),
      BathroomDetailsMapper.view(bathroom)
    );
  }

  public ContributionView createBathroom(BathroomInput input, UUID authorId) {
    var bathroom = new Bathroom();
    bathroom.setAuthor(users.findById(authorId).orElseThrow(ApiException::missing));
    apply(bathroom, input);
    bathrooms.save(bathroom);
    return contributions.contribution(bathroom);
  }

  public ContributionView reviseBathroom(UUID id, BathroomInput input, UUID authorId) {
    var bathroom = bathrooms.findById(id).orElseThrow(ApiException::missing);
    contributions.editable(bathroom, authorId);
    apply(bathroom, input);
    bathroom.setStatus(Status.PENDING);
    bathroom.setReason(null);
    bathrooms.save(bathroom);
    return contributions.contribution(bathroom);
  }

  private void apply(Bathroom bathroom, BathroomInput input) {
    bathroom.setName(input.name().strip());
    bathroom.setAddress(input.address().strip());
    bathroom.setComplement(input.complement() == null ? null : input.complement().strip());
    bathroom.setCategory(input.category().strip());
    bathroom.setLatitude(input.latitude());
    bathroom.setLongitude(input.longitude());
    bathroom.setAccess(input.access());
    bathroom.setAccessDetails(input.accessDetails());
    bathroom.setHours(input.hours());
    bathroom.setAccessible(input.accessible());
    bathroom.setItems(new TreeSet<>(input.items()));
    BathroomDetailsMapper.apply(bathroom, input.details());
  }

  public List<BathroomView> duplicates(String name, double latitude, double longitude) {
    return bathrooms
      .findByStatus(Status.APPROVED)
      .stream()
      .filter(value -> GeographicDistance.meters(latitude, longitude, value.getLatitude(), value.getLongitude()) < 150 && normalize(value.getName()).contains(normalize(name)))
      .limit(5)
      .map(this::view)
      .toList();
  }
}
