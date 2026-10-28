package br.com.khki.service;

import br.com.khki.api.*;
import br.com.khki.api.Contracts.*;
import br.com.khki.domain.*;
import br.com.khki.repository.*;
import java.text.Normalizer;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @Transactional
public class ContentService {
    private final BathroomRepository bathrooms;
    private final ReviewRepository reviews;
    private final PhotoRepository photos;
    private final AppUserRepository users;
    public ContentService(BathroomRepository bathrooms, ReviewRepository reviews, PhotoRepository photos, AppUserRepository users) { this.bathrooms = bathrooms; this.reviews = reviews; this.photos = photos; this.users = users; }
    public Bathroom approved(UUID id) { return bathrooms.findById(id).filter(value -> value.status == Status.APPROVED).orElseThrow(ApiException::missing); }
    private String normalize(String value) { return Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT); }
    public List<BathroomView> search(String query, Access access, Boolean accessible) {
        String term = normalize(query);
        return bathrooms.findByStatus(Status.APPROVED).stream().filter(value -> normalize(value.name + " " + value.address).contains(term)).filter(value -> access == null || value.access == access).filter(value -> accessible == null || accessible.equals(value.accessible)).sorted(Comparator.comparing(value -> value.name)).limit(200).map(this::view).toList();
    }
    public BathroomView view(Bathroom bathroom) {
        var approvedReviews = reviews.findByBathroomIdAndStatusOrderByCreatedAtDesc(bathroom.id, Status.APPROVED);
        Double average = approvedReviews.isEmpty() ? null : approvedReviews.stream().mapToDouble(review -> (review.cleanliness + review.structure) / 2.0).average().orElseThrow();
        return new BathroomView(bathroom.id, bathroom.name, bathroom.address, bathroom.category, bathroom.latitude, bathroom.longitude, bathroom.access, bathroom.accessDetails, bathroom.hours, bathroom.accessible, bathroom.items.isBlank() ? List.of() : List.of(bathroom.items.split(",")), average, approvedReviews.size(), photos.findByBathroomIdAndStatus(bathroom.id, Status.APPROVED).stream().filter(this::parentVisible).map(photo -> photo.id).toList(), bathroom.demo);
    }
    public List<ReviewView> publicReviews(UUID id) {
        approved(id);
        return reviews.findByBathroomIdAndStatusOrderByCreatedAtDesc(id, Status.APPROVED).stream().map(review -> new ReviewView(review.id, users.findById(review.authorId).orElseThrow().name, review.cleanliness, review.structure, review.comment, review.createdAt)).toList();
    }
    public ContributionView createBathroom(BathroomInput input, UUID authorId) { var bathroom = new Bathroom(); bathroom.authorId = authorId; apply(bathroom, input); return contribution(bathrooms.save(bathroom)); }
    public ContributionView reviseBathroom(UUID id, BathroomInput input, UUID authorId) {
        var bathroom = bathrooms.findById(id).orElseThrow(ApiException::missing); editable(bathroom, authorId); apply(bathroom, input); bathroom.status = Status.PENDING; bathroom.reason = null; return contribution(bathrooms.save(bathroom));
    }
    private void apply(Bathroom bathroom, BathroomInput input) {
        bathroom.name = input.name().strip(); bathroom.address = input.address().strip(); bathroom.category = input.category().strip(); bathroom.latitude = input.latitude(); bathroom.longitude = input.longitude(); bathroom.access = input.access(); bathroom.accessDetails = input.accessDetails(); bathroom.hours = input.hours(); bathroom.accessible = input.accessible(); bathroom.items = String.join(",", new TreeSet<>(input.items()));
    }
    private void editable(ModeratedContent content, UUID authorId) { if (!content.authorId.equals(authorId) || content.status != Status.REJECTED) throw new ApiException(HttpStatus.FORBIDDEN, "Somente o autor pode reenviar uma contribuição rejeitada."); }
    public ContributionView createReview(UUID bathroomId, ReviewInput input, UUID authorId) {
        approved(bathroomId); var review = new Review(); review.authorId = authorId; review.bathroomId = bathroomId; applyReview(review, input); return contribution(reviews.save(review));
    }
    private void applyReview(Review review, ReviewInput input) { review.cleanliness = input.cleanliness(); review.structure = input.structure(); review.comment = input.comment(); }
    public ContributionView reviseReview(UUID id, ReviewInput input, UUID authorId) { var review = reviews.findById(id).orElseThrow(ApiException::missing); editable(review, authorId); approved(review.bathroomId); applyReview(review, input); review.status = Status.PENDING; review.reason = null; return contribution(reviews.save(review)); }
    public List<BathroomView> duplicates(String name, double latitude, double longitude) {
        return bathrooms.findByStatus(Status.APPROVED).stream().filter(value -> distance(latitude, longitude, value.latitude, value.longitude) < 150 && normalize(value.name).contains(normalize(name))).limit(5).map(this::view).toList();
    }
    private double distance(double latitude, double longitude, double otherLatitude, double otherLongitude) {
        double deltaLatitude = Math.toRadians(otherLatitude - latitude), deltaLongitude = Math.toRadians(otherLongitude - longitude);
        double haversine = Math.pow(Math.sin(deltaLatitude / 2), 2) + Math.cos(Math.toRadians(latitude)) * Math.cos(Math.toRadians(otherLatitude)) * Math.pow(Math.sin(deltaLongitude / 2), 2);
        return 6371000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
    }
    public boolean parentVisible(Photo photo) { return bathrooms.findById(photo.bathroomId).filter(value -> value.status == Status.APPROVED).isPresent() && (photo.reviewId == null || reviews.findById(photo.reviewId).filter(value -> value.status == Status.APPROVED).isPresent()); }
    public ContributionView contribution(ModeratedContent content) {
        TargetType type = content instanceof Bathroom ? TargetType.BATHROOM : content instanceof Review ? TargetType.REVIEW : TargetType.PHOTO;
        UUID bathroomId = content instanceof Bathroom ? content.id : content instanceof Review review ? review.bathroomId : ((Photo) content).bathroomId;
        String title = content instanceof Bathroom bathroom ? bathroom.name : (type == TargetType.REVIEW ? "Avaliação: " : "Foto: ") + bathrooms.findById(bathroomId).map(value -> value.name).orElse("Banheiro");
        return new ContributionView(content.id, type, title, content.status, content.reason, content.createdAt, bathroomId);
    }
    public List<ContributionView> mine(UUID authorId) {
        var result = new ArrayList<ContributionView>(); bathrooms.findByAuthorIdOrderByCreatedAtDesc(authorId).forEach(value -> result.add(contribution(value))); reviews.findByAuthorIdOrderByCreatedAtDesc(authorId).forEach(value -> result.add(contribution(value))); photos.findByAuthorIdOrderByCreatedAtDesc(authorId).forEach(value -> result.add(contribution(value))); result.sort(Comparator.comparing(ContributionView::createdAt).reversed()); return result;
    }
    public ModeratedContent target(TargetType type, UUID id) { return switch (type) { case BATHROOM -> bathrooms.findById(id).orElseThrow(ApiException::missing); case REVIEW -> reviews.findById(id).orElseThrow(ApiException::missing); case PHOTO -> photos.findById(id).orElseThrow(ApiException::missing); }; }
    public void requirePublic(TargetType type, UUID id) {
        var content = target(type, id); if (content.status != Status.APPROVED) throw ApiException.missing();
        if (content instanceof Review review) approved(review.bathroomId);
        if (content instanceof Photo photo && !parentVisible(photo)) throw ApiException.missing();
    }
}
