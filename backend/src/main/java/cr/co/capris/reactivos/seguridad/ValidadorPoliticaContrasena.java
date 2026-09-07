package cr.co.capris.reactivos.seguridad;

import java.util.List;

/**
 * Contrato de HU-042 (validacion de complejidad de contraseña): minimo 8 caracteres,
 * al menos una mayuscula, una minuscula, un numero y un caracter especial.
 *
 * HU-044, HU-045 y HU-046 dependen de esta interfaz para validar la contraseña nueva
 * en sus propios flujos -- la implementacion de las reglas es responsabilidad de HU-042.
 *
 * @return lista de violaciones encontradas (vacia si la contraseña cumple la politica).
 */
public interface ValidadorPoliticaContrasena {

	List<String> validar(String contrasena);
}
