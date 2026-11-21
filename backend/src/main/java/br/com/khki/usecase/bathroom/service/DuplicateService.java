package br.com.khki.usecase.bathroom.service;

import br.com.khki.shared.domain.GeographicDistance;
import br.com.khki.shared.domain.Status;
import br.com.khki.usecase.bathroom.dto.NearbyCandidateDTO;
import br.com.khki.usecase.bathroom.dto.NearbyResultDTO;
import br.com.khki.usecase.bathroom.model.Bathroom;
import br.com.khki.usecase.bathroom.model.repository.BathroomRepository;
import java.text.Normalizer;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
@PreAuthorize("hasRole('ADMIN')")
public class DuplicateService {

  private final BathroomRepository bathrooms;
  private final BathroomService content;
  private final double defaultRadius;
  private final double nameSimilarity;
  private final double addressSimilarity;

  public DuplicateService(BathroomRepository bathrooms, BathroomService content, @Value("${khki.nearby-radius-meters:${khki.moderation-radius-meters:150}}") double defaultRadius, @Value("${khki.nearby-name-similarity:0.5}") double nameSimilarity, @Value("${khki.nearby-address-similarity:0.65}") double addressSimilarity) {
    if (!Double.isFinite(defaultRadius) || !Double.isFinite(nameSimilarity) || !Double.isFinite(addressSimilarity) || nameSimilarity < 0 || nameSimilarity > 1 || addressSimilarity < 0 || addressSimilarity > 1) throw new IllegalArgumentException("Confira o raio e os limiares de similaridade configurados.");
    this.bathrooms = bathrooms;
    this.content = content;
    this.defaultRadius = Math.max(25, Math.min(1000, defaultRadius));
    this.nameSimilarity = nameSimilarity;
    this.addressSimilarity = addressSimilarity;
  }

  public NearbyResultDTO nearby(Bathroom target, Double requestedRadius) {
    return find(target, requestedRadius);
  }

  @PreAuthorize("isAuthenticated()")
  public NearbyResultDTO preview(String name, String address, String complement, double latitude, double longitude, Double radius) {
    var target = new Bathroom();
    target.setName(name);
    target.setAddress(address);
    target.setComplement(complement);
    target.setLatitude(latitude);
    target.setLongitude(longitude);
    return find(target, radius);
  }

  private NearbyResultDTO find(Bathroom target, Double requestedRadius) {
    double radius = requestedRadius == null ? defaultRadius : requestedRadius;
    double latitudeDelta = radius / 110000;
    var candidates = bathrooms
      .findByStatusAndLatitudeBetween(Status.APPROVED, target.getLatitude() - latitudeDelta, target.getLatitude() + latitudeDelta)
      .stream()
      .filter(value -> !value.getId().equals(target.getId()))
      .map(value -> {
        double distance = GeographicDistance.meters(target.getLatitude(), target.getLongitude(), value.getLatitude(), value.getLongitude());
        boolean differentComplement = !normalize(target.getComplement()).isBlank() && !normalize(value.getComplement()).isBlank() && !normalize(target.getComplement()).equals(normalize(value.getComplement()));
        boolean similar = similarity(target.getName(), value.getName()) >= nameSimilarity || similarity(target.getAddress(), value.getAddress()) >= addressSimilarity;
        return new NearbyCandidateDTO(content.view(value), Math.round(distance * 10) / 10.0, similar, differentComplement);
      })
      .filter(value -> value.distanceMeters() <= radius)
      .sorted(Comparator.comparingDouble(NearbyCandidateDTO::distanceMeters))
      .toList();
    return new NearbyResultDTO(radius, candidates);
  }

  private String normalize(String text) {
    return Normalizer.normalize(text == null ? "" : text, Normalizer.Form.NFD)
      .replaceAll("\\p{M}", "")
      .toLowerCase(Locale.ROOT)
      .replaceAll("[^\\p{L}\\p{N}]+", " ")
      .strip();
  }

  private double similarity(String first, String second) {
    String left = normalize(first),
      right = normalize(second);
    if (left.isBlank() || right.isBlank()) return 0;
    var leftTokens = new HashSet<>(List.of(left.split(" +")));
    var rightTokens = new HashSet<>(List.of(right.split(" +")));
    var common = new HashSet<>(leftTokens);
    common.retainAll(rightTokens);
    return (2.0 * common.size()) / (leftTokens.size() + rightTokens.size());
  }
}
