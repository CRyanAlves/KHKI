package br.com.khki.usecase.image.controller;

import br.com.khki.usecase.contribution.dto.ContributionDTO;
import br.com.khki.usecase.image.service.ImageService;
import br.com.khki.usecase.user.service.UserService;
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
  private final UserService accounts;

  public ImageController(ImageService imageService, UserService accounts) {
    this.imageService = imageService;
    this.accounts = accounts;
  }

  @PostMapping(value = "/bathrooms/{id}/photos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  @ResponseStatus(HttpStatus.CREATED)
  public ContributionDTO upload(@PathVariable UUID id, @RequestParam(required = false) UUID reviewId, @RequestParam(defaultValue = "false") boolean registrationAttachment, @RequestPart MultipartFile file, Principal principal) {
    return imageService.upload(id, reviewId, accounts.current(principal).getId(), file, registrationAttachment);
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
