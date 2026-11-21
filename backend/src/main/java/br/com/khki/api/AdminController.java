package br.com.khki.api;

import br.com.khki.api.Contracts.*;
import br.com.khki.domain.*;
import br.com.khki.service.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.security.Principal;
import java.util.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.validation.annotation.Validated;

@RestController @RequestMapping("/api/admin") @Validated
public class AdminController {
    private final ModerationService moderation;
    private final AccountService accounts;
    private final DuplicateService duplicates;
    private final ContentService content;
    public AdminController(ModerationService moderation, AccountService accounts, DuplicateService duplicates, ContentService content) { this.moderation = moderation; this.accounts = accounts; this.duplicates = duplicates; this.content = content; }
    @GetMapping("/queue") public List<ContributionView> queue(@RequestParam(defaultValue = "PENDING") Status status) { return moderation.queue(status); }
    @GetMapping("/queue/details") public List<ModerationQueueItem> queueDetails(@RequestParam(defaultValue = "PENDING") Status status) { return moderation.queueDetails(status); }
    @GetMapping("/content/{type}/{id}/history") public List<AuditView> history(@PathVariable TargetType type, @PathVariable UUID id) { return moderation.history(type, id); }
    @GetMapping("/bathrooms/{id}/nearby") public NearbyResult nearby(@PathVariable UUID id, @RequestParam(required = false) @DecimalMin("25") @DecimalMax("1000") Double radiusMeters) { return duplicates.nearby((Bathroom) content.target(TargetType.BATHROOM, id), radiusMeters); }
    @GetMapping("/content/{type}/{id}") public Object inspect(@PathVariable TargetType type, @PathVariable UUID id) { return moderation.inspect(type, id); }
    @PostMapping("/content/{type}/{id}/decision") public void decide(@PathVariable TargetType type, @PathVariable UUID id, @Valid @RequestBody Decision input, Principal principal) { moderation.decide(type, id, input, accounts.current(principal).id); }
    @GetMapping("/reports") public List<ReportView> reports(@RequestParam(defaultValue = "false") boolean resolved) { return moderation.reports(resolved); }
    @GetMapping("/reports/{id}") public ReportView report(@PathVariable UUID id) { return moderation.report(id); }
    public record Resolution(@NotBlank @Size(max = 400) String reason, @PositiveOrZero Long expectedVersion, Status status, @PositiveOrZero Long contentVersion) {}
    @PostMapping("/reports/{id}/resolve") public void resolve(@PathVariable UUID id, @Valid @RequestBody Resolution input, Principal principal) { moderation.resolve(id, input.reason(), accounts.current(principal).id, input.expectedVersion(), input.status(), input.contentVersion()); }
    @GetMapping("/audit") public List<ModerationAudit> audit() { return moderation.audit(); }
}