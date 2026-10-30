package br.com.khki.api;

import br.com.khki.domain.*;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

public final class Contracts {

  private Contracts() {}

  public record Register(@NotBlank @Size(max = 80) String name, @NotBlank @Email @Size(max = 254) String email, @NotBlank @Size(min = 10, max = 72) String password) {}

  public record Login(@NotBlank @Email @Size(max = 254) String email, @NotBlank @Size(max = 72) String password) {}

  public record UserView(UUID id, String name, String role) {}

  public record BathroomInput(
    @NotBlank @Size(max = 120) String name,
    @NotBlank @Size(max = 300) String address,
    @NotBlank @Size(max = 80) String category,
    @NotNull @DecimalMin("-90") @DecimalMax("90") Double latitude,
    @NotNull @DecimalMin("-180") @DecimalMax("180") Double longitude,
    @NotNull Access access,
    @Size(max = 300) String accessDetails,
    @Size(max = 200) String hours,
    Boolean accessible,
    @NotNull @Size(max = 8) Set<@Pattern(regexp = "PAPER|SOAP|SINK|DRYER|BIN|CHANGING_TABLE") String> items,
    @Size(max = 200) String complement,
    UUID submissionId
  ) {}

  public record ReviewInput(@Min(1) @Max(5) int cleanliness, @Min(1) @Max(5) int structure, @Size(max = 1500) String comment) {}

  public record BathroomView(UUID id, String name, String address, String category, double latitude, double longitude, Access access, String accessDetails, String hours, Boolean accessible, List<String> items, Double rating, int reviewCount, List<UUID> photoIds, boolean demo, String complement) {}

  public record ReviewView(UUID id, String author, int cleanliness, int structure, String comment, Instant createdAt) {}

  public record ContributionView(UUID id, TargetType type, String title, Status status, String reason, Instant createdAt, UUID bathroomId) {}

  public record Decision(@NotNull Status status, @NotBlank @Size(max = 500) String reason, @PositiveOrZero Long expectedVersion, UUID duplicateOfId) {}

  public record ReportInput(@NotNull TargetType targetType, @NotNull UUID targetId, @NotNull @Pattern(regexp = "INCORRECT|CLOSED|PRIVACY|INAPPROPRIATE|SPAM|OTHER") String reason) {}

  public record ReportView(UUID id, TargetType targetType, UUID targetId, String reason, Instant createdAt, boolean resolved, long version, String title, String address) {}

  public record ModerationDetail(ContributionView contribution, Object content, String author, long version, BathroomView bathroom, List<ContributionView> photos) {}

  public record ModerationQueueItem(ContributionView contribution, String author, String address, String complement, String category, UUID thumbnailId, long version) {}

  public record AuditView(UUID id, TargetType targetType, UUID targetId, UUID moderatorId, String moderator, Status decision, String reason, Instant createdAt, UUID duplicateOfId) {}

  public record NearbyCandidate(BathroomView bathroom, double distanceMeters, boolean possibleDuplicate, boolean differentComplement) {}

  public record NearbyResult(double radiusMeters, List<NearbyCandidate> candidates) {}
}
