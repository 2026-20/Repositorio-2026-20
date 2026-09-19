package cr.co.capris.reactivos.seguridad;

import org.junit.jupiter.api.RepeatedTest;

import static org.assertj.core.api.Assertions.assertThat;

class GeneradorOtpTest {

	@RepeatedTest(20)
	void siempreGeneraSeisDigitosNumericos() {
		String otp = GeneradorOtp.generarSeisDigitos();

		assertThat(otp).hasSize(6);
		assertThat(otp).matches("\\d{6}");
	}
}
