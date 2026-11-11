package br.com.khki.usecase.bathroom;

import br.com.khki.shared.api.Contracts.*;
import br.com.khki.usecase.account.AccountService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.security.Principal;
import java.util.*;
import org.springframework.http.*;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
@Validated
public class BathroomController {

  private final BathroomService bathroomService;
  private final AccountService accounts;
  private final DuplicateService duplicates;

  public BathroomController(BathroomService bathroomService, AccountService accounts, DuplicateService duplicates) {
    this.bathroomService = bathroomService;
    this.accounts = accounts;
    this.duplicates = duplicates;
  }

  @GetMapping("/bathrooms")
  public List<BathroomView> list(@RequestParam(defaultValue = "") @Size(max = 200) String q, @RequestParam(required = false) AccessType access, @RequestParam(required = false) Boolean accessible, @RequestParam(defaultValue = "0") @Min(0) @Max(100000) int offset) {
    return bathroomService.search(q, access, accessible, offset);
  }

  @GetMapping("/bathrooms/duplicates")
  public List<BathroomView> duplicates(@RequestParam @Size(min = 2, max = 120) String name, @RequestParam @DecimalMin("-90") @DecimalMax("90") double latitude, @RequestParam @DecimalMin("-180") @DecimalMax("180") double longitude) {
    return bathroomService.duplicates(name, latitude, longitude);
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
    return bathroomService.view(bathroomService.approved(id));
  }

  @PostMapping("/bathrooms")
  @ResponseStatus(HttpStatus.CREATED)
  public ContributionView create(@Valid @RequestBody BathroomInput input, Principal principal) {
    return bathroomService.createBathroom(input, accounts.current(principal).getId());
  }

  @PutMapping("/bathrooms/{id}")
  public ContributionView revise(@PathVariable UUID id, @Valid @RequestBody BathroomInput input, Principal principal) {
    return bathroomService.reviseBathroom(id, input, accounts.current(principal).getId());
  }
}
