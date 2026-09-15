package cr.co.capris.reactivos.auth;

import io.jsonwebtoken.Claims;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class SesionController {

    private final JwtService jwtService;
    private final TokenSesionRevocadoService tokenSesionRevocadoService;

    public SesionController(
            JwtService jwtService,
            TokenSesionRevocadoService tokenSesionRevocadoService
    ) {
        this.jwtService = jwtService;
        this.tokenSesionRevocadoService = tokenSesionRevocadoService;
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(
            @RequestHeader("Authorization") String authorization
    ) {
        String token = authorization.substring(7);

        Claims claims =
                jwtService.validarYObtenerClaims(token);

        tokenSesionRevocadoService.revocar(claims);
    }
}