package br.com.khki.usecase.moderation.dto;

import br.com.khki.usecase.bathroom.dto.BathroomDTO;
import br.com.khki.usecase.contribution.dto.ContributionDTO;
import br.com.khki.usecase.image.dto.ImageDTO;
import java.util.List;

public record ModerationDetailDTO(ContributionDTO contribution, Object content, String author, long version, BathroomDTO bathroom, List<ImageDTO> photos) {}
