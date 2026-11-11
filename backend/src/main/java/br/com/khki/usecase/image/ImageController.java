package br.com.khki.usecase.image;

import br.com.khki.shared.api.Contracts.*;
import br.com.khki.usecase.account.AccountService;
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
public class ImageController {

  private final ImageService imageService;
  private final AccountService accounts;

  public ImageController(ImageService imageService, AccountService accounts) {
    this.imageService = imageService;
    this.accounts = accounts;
  }

  @PostMapping(value = "/bathrooms/{id}/photos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  @ResponseStatus(HttpStatus.CREATED)
  public ContributionView upload(@PathVariable UUID id, @RequestParam(required = false) UUID reviewId, @RequestParam(required = false) UUID submissionId, @RequestParam(defaultValue = "false") boolean registrationAttachment, @RequestPart MultipartFile file, Principal principal) {
    return imageService.upload(id, reviewId, accounts.current(principal).getId(), file, submissionId, registrationAttachment);
  }

  @GetMapping("/photos/{id}")
  public ResponseEntity<byte[]> photo(@PathVariable UUID id, Principal principal) {
    return ResponseEntity.ok()
      .contentType(MediaType.IMAGE_JPEG)
      .cacheControl(CacheControl.noStore())
      .header("Content-Disposition", "inline; filename=photo.jpg")
      .body(imageService.read(id, principal == null ? null : accounts.current(principal)));
  }
}
