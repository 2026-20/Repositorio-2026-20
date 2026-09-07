package cr.co.capris.reactivos.usuario;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Corre las migraciones reales de Flyway (V1/V2/V3, ver src/main/resources/db/migration)
 * contra un Postgres real -- confirma que el SQL de la semilla es valido y que los
 * 3 usuarios iniciales quedan con el rol y estado correctos.
 * Requiere Docker; se ejecuta con "mvn verify", no con "mvn test".
 */
@Testcontainers
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class UsuarioRepositoryIT {

	@Container
	@ServiceConnection
	static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

	@Autowired
	private UsuarioRepository usuarioRepository;

	@Test
	void lasMigracionesFlywayCarganLosTresUsuariosSemilla() {
		assertThat(usuarioRepository.findAll()).hasSize(3);
	}

	@Test
	void williamMolinaQuedaComoAdministradorActivo() {
		Optional<Usuario> william = usuarioRepository.findByUsername("wmolina");

		assertThat(william).isPresent();
		assertThat(william.get().getRol().getNombre()).isEqualTo("Administrador");
		assertThat(william.get().getEstado()).isEqualTo(EstadoUsuario.ACTIVO);
		assertThat(william.get().getEmpresa().getNombre()).isEqualTo("CAPRIS Médica");
	}

	@Test
	void andreyYAdrianQuedanComoUsuarioDeCampo() {
		Optional<Usuario> andrey = usuarioRepository.findByUsername("amelendez");
		Optional<Usuario> adrian = usuarioRepository.findByUsername("arcea");

		assertThat(andrey).isPresent();
		assertThat(adrian).isPresent();
		assertThat(andrey.get().getRol().getNombre()).isEqualTo("Usuario de Campo");
		assertThat(adrian.get().getRol().getNombre()).isEqualTo("Usuario de Campo");
	}

	@Test
	void losCamposDeBloqueoDeLaBaseSeguridadSprint1QuedanMapeadosPorDefecto() {
		Optional<Usuario> william = usuarioRepository.findByUsername("wmolina");

		assertThat(william).isPresent();
		assertThat(william.get().getIntentosFallidos()).isZero();
		assertThat(william.get().getBloqueadoHasta()).isNull();
	}
}
