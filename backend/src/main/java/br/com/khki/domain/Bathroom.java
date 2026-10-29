package br.com.khki.domain;
import jakarta.persistence.*;
@Entity @Table(name = "bathrooms")
public class Bathroom extends ModeratedContent {
    @Column(nullable = false, length = 120) public String name;
    @Column(nullable = false, length = 300) public String address;
    @Column(length = 200) public String complement;
    @Column(nullable = false, length = 80) public String category;
    public double latitude;
    public double longitude;
    @Enumerated(EnumType.STRING) @Column(nullable = false) public Access access;
    @Column(length = 300) public String accessDetails;
    @Column(length = 200) public String hours;
    public Boolean accessible;
    @Column(nullable = false, length = 400) public String items = "";
    public boolean demo;
}