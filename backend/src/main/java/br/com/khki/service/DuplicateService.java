package br.com.khki.service;

import br.com.khki.api.Contracts.*;
import br.com.khki.domain.*;
import br.com.khki.repository.BathroomRepository;
import java.text.Normalizer;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @Transactional(readOnly = true) @PreAuthorize("hasRole('ADMIN')")
public class DuplicateService {
    private final BathroomRepository bathrooms;
    private final ContentService content;
    private final double defaultRadius;
    private final double nameSimilarity;
    private final double addressSimilarity;
    public DuplicateService(BathroomRepository bathrooms, ContentService content, @Value("${khki.nearby-radius-meters:${khki.moderation-radius-meters:150}}") double defaultRadius, @Value("${khki.nearby-name-similarity:0.5}") double nameSimilarity, @Value("${khki.nearby-address-similarity:0.65}") double addressSimilarity) {
        if (!Double.isFinite(defaultRadius) || !Double.isFinite(nameSimilarity) || !Double.isFinite(addressSimilarity) || nameSimilarity < 0 || nameSimilarity > 1 || addressSimilarity < 0 || addressSimilarity > 1) throw new IllegalArgumentException("Confira o raio e os limiares de similaridade configurados.");
        this.bathrooms = bathrooms; this.content = content; this.defaultRadius = Math.max(25, Math.min(1000, defaultRadius)); this.nameSimilarity = nameSimilarity; this.addressSimilarity = addressSimilarity;
    }
    public NearbyResult nearby(Bathroom target, Double requestedRadius) {
        return find(target, requestedRadius);
    }
    @PreAuthorize("isAuthenticated()")
    public NearbyResult preview(String name, String address, String complement, double latitude, double longitude, Double radius) { var target = new Bathroom(); target.name = name; target.address = address; target.complement = complement; target.latitude = latitude; target.longitude = longitude; return find(target, radius); }
    private NearbyResult find(Bathroom target, Double requestedRadius) {
        double radius = requestedRadius == null ? defaultRadius : requestedRadius;
        double latitudeDelta = radius / 110000;
        var candidates = bathrooms.findByStatusAndLatitudeBetween(Status.APPROVED, target.latitude - latitudeDelta, target.latitude + latitudeDelta).stream().filter(value -> !value.id.equals(target.id)).map(value -> {
            double distance = distance(target.latitude, target.longitude, value.latitude, value.longitude);
            boolean differentComplement = !normalize(target.complement).isBlank() && !normalize(value.complement).isBlank() && !normalize(target.complement).equals(normalize(value.complement));
            boolean similar = similarity(target.name, value.name) >= nameSimilarity || similarity(target.address, value.address) >= addressSimilarity;
            return new NearbyCandidate(content.view(value), Math.round(distance * 10) / 10.0, similar, differentComplement);
        }).filter(value -> value.distanceMeters() <= radius).sorted(Comparator.comparingDouble(NearbyCandidate::distanceMeters)).toList();
        return new NearbyResult(radius, candidates);
    }
    private String normalize(String text) { return Normalizer.normalize(text == null ? "" : text, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}]+", " ").strip(); }
    private double similarity(String first, String second) {
        String left = normalize(first), right = normalize(second); if (left.isBlank() || right.isBlank()) return 0;
        var leftTokens = new HashSet<>(List.of(left.split(" +"))); var rightTokens = new HashSet<>(List.of(right.split(" +"))); var common = new HashSet<>(leftTokens); common.retainAll(rightTokens);
        return 2.0 * common.size() / (leftTokens.size() + rightTokens.size());
    }
    private double distance(double latitude, double longitude, double otherLatitude, double otherLongitude) {
        double deltaLatitude = Math.toRadians(otherLatitude - latitude), deltaLongitude = Math.toRadians(otherLongitude - longitude);
        double haversine = Math.pow(Math.sin(deltaLatitude / 2), 2) + Math.cos(Math.toRadians(latitude)) * Math.cos(Math.toRadians(otherLatitude)) * Math.pow(Math.sin(deltaLongitude / 2), 2);
        return 6371000 * 2 * Math.asin(Math.sqrt(Math.max(0, Math.min(1, haversine))));
    }
}