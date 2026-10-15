package cr.co.capris.reactivos.seguridad;

/** HU-050: los tres avisos que se mandan antes de que la contraseña venza. */
public enum TipoAvisoCaducidad {
	CINCO_DIAS(5),
	TRES_DIAS(3),
	UN_DIA(1);

	private final int dias;

	TipoAvisoCaducidad(int dias) {
		this.dias = dias;
	}

	public int getDias() {
		return dias;
	}
}
