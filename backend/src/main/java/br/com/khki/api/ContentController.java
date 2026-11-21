package br.com.khki.api;

import br.com.khki.api.Contracts.*;
import br.com.khki.domain.*;
import br.com.khki.repository.ReportRepository;
import br.com.khki.security.AbuseGuard;
import br.com.khki.service.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.security.Principal;
import java.util.*;
import org.springframework.http.*;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api")
@Validated
public class ContentController {

  private final ContentService content;
  private final AccountService accounts;
  private final PhotoService photos;
  private final ReportRepository reports;
  private final AbuseGuard abuse;
  private final DuplicateService duplicates;

  public ContentController(ContentService content, AccountService accounts, PhotoService photos, ReportRepository reports, AbuseGuard abuse, DuplicateService duplicates) {
    this.content = content;
    this.accounts = accounts;
    this.photos = photos;
    this.reports = reports;
    this.abuse = abuse;
    this.duplicates = duplicates;
  }

  @GetMapping("/bathrooms")
  public List<BathroomView> list(@RequestParam(defaultValue = "") @Size(max = 200) String q, @RequestParam(required = false) Access access, @RequestParam(required = false) Boolean accessible) {
    return content.search(q, access, accessible);
  }

  @GetMapping("/bathrooms/duplicates")
  public List<BathroomView> duplicates(@RequestParam @Size(min = 2, max = 120) String name, @RequestParam @DecimalMin("-90") @DecimalMax("90") double latitude, @RequestParam @DecimalMin("-180") @DecimalMax("180") double longitude) {
    return content.duplicates(name, latitude, longitude);
  }

  @GetMapping("/bathrooms/nearby")
  public NearbyResult nearby(
    @RequestParam(defaultValue = "") @Size(max = 120) String name,
    @RequestParam(defaultValue = "") @Size(max = 300) String address,
    @RequestParam(defaultValue = "") @Size(max = 200) String complement,
    @RequestParam @DecimalMin("-90") @DecimalMax("90") double latitude,
    @RequestParam @DecimalMin("-180") @DecimalMax("180") double longitude,
    @RequestParam(required = false) @DecimalMin("25") @DecimalMax("1000") Double radiusMeters
  ) {
    return duplicates.preview(name, address, complement, latitude, longitude, radiusMeters);
  }

  @GetMapping("/bathrooms/{id}")
  public BathroomView details(@PathVariable UUID id) {
    return content.view(content.approved(id));
  }

  @GetMapping("/bathrooms/{id}/reviews")
  public List<ReviewView> reviews(@PathVariable UUID id) {
    return content.publicReviews(id);
  }

  @PostMapping("/bathrooms")
  @ResponseStatus(HttpStatus.CREATED)
  public ContributionView create(@Valid @RequestBody BathroomInput input, Principal principal) {
    return content.createBathroom(input, accounts.current(principal).id);
  }

  @PutMapping("/bathrooms/{id}")
  public ContributionView revise(@PathVariable UUID id, @Valid @RequestBody BathroomInput input, Principal principal) {
    return content.reviseBathroom(id, input, accounts.current(principal).id);
  }

  @PostMapping("/bathrooms/{id}/reviews")
  @ResponseStatus(HttpStatus.CREATED)
  public ContributionView review(@PathVariable UUID id, @Valid @RequestBody ReviewInput input, Principal principal) {
    return content.createReview(id, input, accounts.current(principal).id);
  }

  @PutMapping("/reviews/{id}")
  public ContributionView reviseReview(@PathVariable UUID id, @Valid @RequestBody ReviewInput input, Principal principal) {
    return content.reviseReview(id, input, accounts.current(principal).id);
  }

  @PostMapping(value = "/bathrooms/{id}/photos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  @ResponseStatus(HttpStatus.CREATED)
  public ContributionView upload(@PathVariable UUID id, @RequestParam(required = false) UUID reviewId, @RequestParam(required = false) UUID submissionId, @RequestParam(defaultValue = "false") boolean registrationAttachment, @RequestPart MultipartFile file, Principal principal) {
    return photos.upload(id, reviewId, accounts.current(principal).id, file, submissionId, registrationAttachment);
  }

  @GetMapping("/photos/{id}")
  public ResponseEntity<byte[]> photo(@PathVariable UUID id, Principal principal) {
    return ResponseEntity.ok()
      .contentType(MediaType.IMAGE_JPEG)
      .cacheControl(CacheControl.noStore())
      .header("Content-Disposition", "inline; filename=photo.jpg")
      .body(photos.read(id, principal == null ? null : accounts.current(principal)));
  }

  @GetMapping("/me/contributions")
  public List<ContributionView> mine(Principal principal) {
    return content.mine(accounts.current(principal).id);
  }

  @GetMapping("/me/submissions/{id}")
  public ContributionView submission(@PathVariable UUID id, Principal principal) {
    return content.submission(id, accounts.current(principal).id);
  }

  @GetMapping("/me/contributions/{type}/{id}")
  public Object own(@PathVariable TargetType type, @PathVariable UUID id, Principal principal) {
    var target = content.target(type, id);
    if (!target.authorId.equals(accounts.current(principal).id)) throw ApiException.missing();
    if (target instanceof Bathroom bathroom) return content.view(bathroom);
    if (target instanceof Review review) return new ReviewView(review.id, "Sua avaliação", review.cleanliness, review.structure, review.comment, review.createdAt);
    return content.contribution(target);
  }

  @PostMapping("/reports")
  @ResponseStatus(HttpStatus.ACCEPTED)
  public Map<String, String> report(@Valid @RequestBody ReportInput input, HttpServletRequest request) {
    content.requirePublic(input.targetType(), input.targetId());
    abuse.check("report:" + request.getRemoteAddr() + ":" + input.targetId(), 1, 600);
    var report = new Report();
    report.targetId = input.targetId();
    report.targetType = input.targetType();
    report.reason = input.reason();
    reports.save(report);
    return Map.of("message", "Denúncia recebida para análise.");
  }
}
