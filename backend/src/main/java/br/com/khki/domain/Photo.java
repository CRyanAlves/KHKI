package br.com.khki.domain;
import jakarta.persistence.*;
import java.util.UUID;
@Entity @Table(name = "photos")
public class Photo extends ModeratedContent {
    @Column(nullable = false) public UUID bathroomId;
    public UUID reviewId;
    @Column(nullable = false, columnDefinition = "bytea") public byte[] data;
}