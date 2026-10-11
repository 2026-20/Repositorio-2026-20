package cr.co.capris.ftpgateway;

import org.springframework.context.annotation.Profile;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;

/**
 * Interfaz manual para pruebas: deja subir un XML por el navegador y
 * reenviarlo al backend exactamente por el mismo camino que usa el flujo
 * real del FTP (ver ReenviadorAlBackend.reenviarManual), sin tener que
 * levantar un FTP de prueba ni usar curl/Postman a mano.
 *
 * Detras de un perfil ("simulador") a proposito -- este controller expone
 * un endpoint que termina disparando una escritura real en la base del
 * backend (via /api/auditoria/ingesta/**), y no deberia quedar accesible
 * sin querer en un ambiente que no sea de pruebas. Se activa con
 * --spring.profiles.active=simulador (ver README.md de este proyecto).
 */
@RestController
@Profile("simulador")
public class SimuladorIngestaController {

    private final ReenviadorAlBackend reenviador;
    private final Resource paginaSimulador = new ClassPathResource("simulador/index.html");

    public SimuladorIngestaController(ReenviadorAlBackend reenviador) {
        this.reenviador = reenviador;
    }

    @GetMapping(value = "/simulador", produces = MediaType.TEXT_HTML_VALUE)
    public Resource formulario() {
        return paginaSimulador;
    }

    @PostMapping("/simulador/ingesta")
    public ReenviadorAlBackend.ResultadoReenvio ingestar(
            @RequestParam("archivo") MultipartFile archivo,
            @RequestParam("nombreArchivo") String nombreArchivo) throws IOException {
        try (InputStream contenido = archivo.getInputStream()) {
            return reenviador.reenviarManual(contenido, nombreArchivo);
        }
    }
}
