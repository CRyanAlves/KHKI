package br.com.khki.api;

import br.com.khki.api.Contracts.*;
import br.com.khki.domain.*;
import br.com.khki.service.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.security.Principal;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/admin")
public class AdminController {
    private final ModerationService moderation;
    private final AccountService accounts;
    public AdminController(ModerationService moderation, AccountService accounts) { this.moderation = moderation; this.accounts = accounts; }
    @GetMapping("/queue") public List<ContributionView> queue(@RequestParam(defaultValue = "PENDING") Status status) { return moderation.queue(status); }
    @GetMapping("/content/{type}/{id}") public Object inspect(@PathVariable TargetType type, @PathVariable UUID id) { return moderation.inspect(type, id); }
    @PostMapping("/content/{type}/{id}/decision") public void decide(@PathVariable TargetType type, @PathVariable UUID id, @Valid @RequestBody Decision input, Principal principal) { moderation.decide(type, id, input, accounts.current(principal).id); }
    @GetMapping("/reports") public List<ReportView> reports() { return moderation.reports(); }
    public record Resolution(@NotBlank @Size(max = 400) String reason) {}
    @PostMapping("/reports/{id}/resolve") public void resolve(@PathVariable UUID id, @Valid @RequestBody Resolution input, Principal principal) { moderation.resolve(id, input.reason(), accounts.current(principal).id); }
    @GetMapping("/audit") public List<ModerationAudit> audit() { return moderation.audit(); }
}
