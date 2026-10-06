package cr.co.capris.ftpgateway;

import org.apache.commons.net.ftp.FTPFile;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.integration.file.remote.session.CachingSessionFactory;
import org.springframework.integration.file.remote.session.SessionFactory;
import org.springframework.integration.ftp.session.DefaultFtpSessionFactory;

/**
 * Conexion al FTP del ERP. DefaultFtpSessionFactory es FTP plano -- el
 * ERP todavia no confirmo si puede ofrecer SFTP/FTPS (ver duda en
 * docs/SERVIDOR_PUENTE_FTP.md). Si algun dia lo confirma, el cambio queda
 * acotado a esta clase (cambiar a DefaultSftpSessionFactory), el resto
 * del flujo no deberia tener que tocarse.
 */
@Configuration
public class FtpSessionFactoryConfig {

	@Bean
	public SessionFactory<FTPFile> ftpSessionFactory(
			@Value("${app.ftp.host}") String host,
			@Value("${app.ftp.port:21}") int port,
			@Value("${app.ftp.usuario}") String usuario,
			@Value("${app.ftp.password}") String password) {
		DefaultFtpSessionFactory factory = new DefaultFtpSessionFactory();
		factory.setHost(host);
		factory.setPort(port);
		factory.setUsername(usuario);
		factory.setPassword(password);
		// Modo pasivo: el cliente (este servidor puente) abre ambas
		// conexiones hacia el FTP, en vez de que el FTP tenga que abrir una
		// conexion de vuelta hacia aqui -- mas facil de que funcione detras
		// de NAT/firewall sin reglas especiales.
		factory.setClientMode(org.apache.commons.net.ftp.FTPClient.PASSIVE_LOCAL_DATA_CONNECTION_MODE);
		// CachingSessionFactory reutiliza conexiones FTP ya autenticadas en
		// vez de abrir una nueva (handshake + login) en cada ciclo de
		// polling. Las sesiones vuelven al pool al cerrarse (ver
		// ReenviadorAlBackend.cerrarSesionFtp) -- sin eso, el pool se
		// agotaria igual que se agotarian las conexiones sin cache.
		return new CachingSessionFactory<>(factory);
	}
}
