package cr.co.capris.reactivos.auditoria;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface LoteBodegaRepository extends JpaRepository<LoteBodega, Long> {

	List<LoteBodega> findAllByCodBod(String codBod);

	List<LoteBodega> findAllByCodBodAndCodArt(String codBod, String codArt);

	Optional<LoteBodega> findByCodBodAndCodArtAndNumLote(String codBod, String codArt, String numLote);
}
