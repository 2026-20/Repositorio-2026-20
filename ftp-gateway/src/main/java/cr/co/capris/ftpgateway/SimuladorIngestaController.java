package cr.co.capris.ftpgateway;

import com.fasterxml.jackson.annotation.JsonProperty;

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
import java.util.ArrayList;
import java.util.List;

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

    /**
     * Mismos 4 XML de backend/src/test/resources/auditoria/xmls, empacados
     * aqui como recurso principal (ftp-gateway no tiene acceso en runtime a
     * los test resources de otro modulo Maven) -- son el "set" minimo para
     * dejar una bodega lista para contar: catalogo de bodegas, su detalle,
     * sus lotes, y la visita que la asigna. No se incluyen cai_det_mov/
     * cai_lot_mov (movimientos pendientes): no hacen falta para HU-005..008.
     */
    private static final String[] ARCHIVOS_DATOS_PRUEBA = {
            "med_wmolina_cai_bod.xml",
            "med_wmolina_cai_det_bod.xml",
            "med_wmolina_cai_lot_bod.xml",
            "med_wmolina_cai_est_vis.xml",
    };

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
            @RequestParam("nombreArchivo") String nombreArchivo,
            @RequestParam(value = "asignarAUsuario", required = false) String asignarAUsuario) throws IOException {
        try (InputStream contenido = archivo.getInputStream()) {
            return reenviador.reenviarManual(contenido, nombreArchivo, asignarAUsuario);
        }
    }

    /**
     * Resultado de ingestarDatosDePrueba: una lista en vez de un solo
     * ResultadoReenvio porque aqui se mandan varios archivos en una sola
     * llamada -- exito() es true solo si los 4 lo fueron, para que el
     * frontend pueda seguir usando el mismo criterio "cuerpo.exito" que ya
     * usa con /simulador/ingesta.
     */
    public record ResultadoIngestaRapida(List<ReenviadorAlBackend.ResultadoReenvio> resultados) {
        // exito no es un componente del record -- sin @JsonProperty, Jackson
        // no lo serializa (no sigue la convencion getX/isX), y el frontend
        // (que lee cuerpo.exito igual que con /simulador/ingesta) siempre
        // veria "error" aunque los 4 archivos se hayan reenviado bien.
        @JsonProperty("exito")
        public boolean exito() {
            return resultados.stream().allMatch(ReenviadorAlBackend.ResultadoReenvio::exito);
        }
    }

    /**
     * Atajo para pruebas de usabilidad: en vez de subir los 4 XML a mano
     * cada vez que se quiere dejar lista una bodega para un usuario de
     * prueba distinto, reenvia los XML ya empacados en datos-prueba/ (ver
     * ARCHIVOS_DATOS_PRUEBA) tal cual los subiria el formulario normal.
     *
     * asignarAUsuario es obligatorio aqui (a diferencia de /simulador/
     * ingesta) -- el unico motivo de este atajo es dejarle datos a un
     * usuario de prueba conocido sin tener que repetir la carga manual; si
     * no se quiere asignar a nadie, tiene mas sentido usar el formulario
     * normal con los archivos reales.
     *
     * cai_det_bod/cai_lot_bod tienen ~1962/~1691 filas cada uno y se
     * ingestan fila por fila en transacciones separadas (ver javadoc de
     * AuditoriaFilaTransaccional en el backend) -- esta llamada puede tardar
     * bastante (decenas de segundos), es esperado y no un cuelgue.
     */
    @PostMapping("/simulador/ingesta-rapida")
    public ResultadoIngestaRapida ingestarDatosDePrueba(
            @RequestParam(value = "asignarAUsuario", required = false) String asignarAUsuario) throws IOException {
        if (asignarAUsuario == null || asignarAUsuario.isBlank()) {
            return new ResultadoIngestaRapida(List.of(new ReenviadorAlBackend.ResultadoReenvio(
                    false, null, null, "Hace falta indicar a que usuario asignarle los datos de prueba.")));
        }

        List<ReenviadorAlBackend.ResultadoReenvio> resultados = new ArrayList<>();
        for (String archivo : ARCHIVOS_DATOS_PRUEBA) {
            // El username solo tiene efecto en estados-visita (ver
            // ReenviadorAlBackend/AuditoriaIngestaController) -- se podria
            // mandar igual en los otros 3, pero no mandarlo ahi deja mas
            // claro en el log del backend cual de los 4 fue el que asigno.
            String usuarioParaEsteArchivo = archivo.contains("cai_est_vis") ? asignarAUsuario : null;
            try (InputStream contenido = new ClassPathResource("datos-prueba/" + archivo).getInputStream()) {
                resultados.add(reenviador.reenviarManual(contenido, archivo, usuarioParaEsteArchivo));
            }
        }
        return new ResultadoIngestaRapida(resultados);
    }
}
