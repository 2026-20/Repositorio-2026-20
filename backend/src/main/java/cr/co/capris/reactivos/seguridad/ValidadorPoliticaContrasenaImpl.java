package cr.co.capris.reactivos.seguridad;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
public class ValidadorPoliticaContrasenaImpl implements ValidadorPoliticaContrasena {

    private static final int LONGITUD_MINIMA = 8;

    @Override
    public List<String> validar(String contrasena) {

        List<String> violaciones = new ArrayList<>();

        String valor = contrasena == null ? "" : contrasena;

        if (valor.length() < LONGITUD_MINIMA) {
            violaciones.add("La contraseña debe tener al menos 8 caracteres");
        }

        if (valor.chars().noneMatch(c -> c >= 'A' && c <= 'Z')) {

            violaciones.add("La contraseña debe contener al menos una letra mayúscula");
        }

        if (valor.chars().noneMatch(c -> c >= 'a' && c <= 'z')) {
            violaciones.add("La contraseña debe contener al menos una letra minúscula");
        }

        if (valor.chars().noneMatch(c -> c >= '0' && c <= '9')) {
            violaciones.add("La contraseña debe contener al menos un número");
        }

        if (valor.chars().noneMatch(c -> !Character.isLetterOrDigit(c)
                        && !Character.isWhitespace(c))) {
            violaciones.add("La contraseña debe contener al menos un carácter especial");
        }

        return List.copyOf(violaciones);
    }
}
