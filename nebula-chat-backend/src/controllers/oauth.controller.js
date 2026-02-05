export const googleCallback = (req, res) => {
  res.redirect(process.env.CLIENT_URL);
};
export const logoutOAuth = (req, res) => {
  req.logout(() => {
    res.redirect(process.env.CLIENT_URL);
  });
};
