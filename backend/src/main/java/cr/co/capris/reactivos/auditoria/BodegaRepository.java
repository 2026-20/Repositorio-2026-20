package cr.co.capris.reactivos.auditoria;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface BodegaRepository extends JpaRepository<Bodega, Long> {

	// (num_con, cod_bod) solo no alcanza -- ver javadoc de Bodega sobre
	// "MEPRIN" repetido con dos tipo_bod distintos.
	Optional<Bodega> findByNumConAndCodBodAndTipoBod(String numCon, String codBod, TipoBodega tipoBod);
}
