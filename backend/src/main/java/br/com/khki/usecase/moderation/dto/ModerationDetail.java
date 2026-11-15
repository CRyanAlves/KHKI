package br.com.khki.usecase.moderation.dto;

import br.com.khki.usecase.bathroom.dto.BathroomView;
import br.com.khki.usecase.contribution.dto.ContributionView;
import br.com.khki.usecase.image.dto.ImageView;
import java.util.List;

public record ModerationDetail(ContributionView contribution, Object content, String author, long version, BathroomView bathroom, List<ImageView> photos) {}
