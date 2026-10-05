package cr.co.capris.reactivos.auditoria;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DetalleBodegaRepository extends JpaRepository<DetalleBodega, Long> {

	// (cod_bod, cod_art) solo no alcanza -- ver javadoc de DetalleBodega
	// sobre el mismo articulo bajo dos contratos distintos.
	Optional<DetalleBodega> findByCodBodAndCodArtAndNumCon(String codBod, String codArt, String numCon);

	List<DetalleBodega> findAllByCodBodAndCodArt(String codBod, String codArt);

	List<DetalleBodega> findAllByCodBod(String codBod);
}
