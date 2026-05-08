// Centralise les secrets critiques — fail-fast si absents ou trop courts.
// Générer un secret fort : node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error(
    '[FATAL] JWT_SECRET manquant ou trop court (minimum 32 caractères).\n' +
    '        Définissez-le dans votre fichier .env avant de démarrer.'
  );
  process.exit(1);
}

module.exports = { JWT_SECRET };
