package br.com.khki.usecase.bathroom;

import br.com.khki.shared.api.ApiException;
import br.com.khki.shared.api.Contracts.*;
import br.com.khki.shared.domain.Status;
import br.com.khki.usecase.contribution.ContributionService;
import br.com.khki.usecase.image.ImageUrls;
import br.com.khki.usecase.review.ReviewRepository;
import java.text.Normalizer;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class BathroomService {

  private final BathroomRepository bathrooms;
  private final ReviewRepository reviews;
  private final ContributionService contributions;

  public BathroomService(BathroomRepository bathrooms, ReviewRepository reviews, ContributionService contributions) {
    this.bathrooms = bathrooms;
    this.reviews = reviews;
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

  public List<BathroomView> search(String query, AccessType access, Boolean accessible) {
    return search(query, access, accessible, 0);
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
    var approvedReviews = reviews.findByBathroomIdAndStatusOrderByCreatedAtDesc(bathroom.getId(), Status.APPROVED).stream().filter(review -> !review.getPhotoOnly()).toList();
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
      java.util.stream.Stream.concat(bathroom.getImageUrls().stream(), reviews.findByBathroomIdAndStatusOrderByCreatedAtDesc(bathroom.getId(), Status.APPROVED).stream().flatMap(review -> review.getImageUrls().stream())).map(ImageUrls::id).distinct().toList(),
      bathroom.getDemo(),
      bathroom.getComplement(),
      BathroomDetailsMapper.view(bathroom)
    );
  }

  public ContributionView createBathroom(BathroomInput input, UUID authorId) {
    var bathroom = new Bathroom();
    bathroom.setAuthorId(authorId);
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
      .filter(value -> distance(latitude, longitude, value.getLatitude(), value.getLongitude()) < 150 && normalize(value.getName()).contains(normalize(name)))
      .limit(5)
      .map(this::view)
      .toList();
  }

  private double distance(double latitude, double longitude, double otherLatitude, double otherLongitude) {
    double deltaLatitude = Math.toRadians(otherLatitude - latitude),
      deltaLongitude = Math.toRadians(otherLongitude - longitude);
    double haversine = Math.pow(Math.sin(deltaLatitude / 2), 2) + Math.cos(Math.toRadians(latitude)) * Math.cos(Math.toRadians(otherLatitude)) * Math.pow(Math.sin(deltaLongitude / 2), 2);
    return 6371000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  }
}
