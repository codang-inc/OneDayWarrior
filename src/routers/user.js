const express = require("express");
const { update, findOne } = require("../models/user");
const User = require("../models/user");
const randomize = require("randomatic");
const saveOTP = require("../functions/otp");
const nodemailer = require("nodemailer");
const puppeteer = require("puppeteer");
const fs = require("fs-extra");
const path = require("path");
const hbs = require("hbs");
const router = new express.Router();
const createPDF = require("../functions/createPDF");
const sendMail = require("../mails/sendMail");
const { send } = require("@sendgrid/mail");

var email;

const compile = async function (templateName, data) {
  const filePath = path.join(
    __dirname,
    "../../templates/views",
    `${templateName}.hbs`
  );
  console.log(filePath);
  const html = await fs.readFile(filePath, "utf-8");
  return hbs.compile(html)(data);
};
const takeScreenshot = async (user) => {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();

  const imagePath = path.join(
    __dirname,
    "../../public/assets/images/website.jpeg"
  );
  console.log(imagePath);
  const content = await compile("success", {
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    date: user.date,
  });
  const options = {
    path: imagePath,
    quality: 100,
    fullPage: true,
    type: "jpeg",
    width: "2000px",
  };
  await page.setContent(content);
  await page.setDefaultNavigationTimeout(0);
  await page.setViewport({
    width: 1536,
    height: 960,
  });
  await page.screenshot(options);
  await browser.close();
};

router.get("/register", async (req, res) => {
  try {
    res.render("login");
  } catch (err) {
    res.render("error", { err });
  }
});

router.post("/verification", async (req, res) => {
  try {
    email = req.body.email;
    const user = await User.findOne({ email });
    if (req.body.email) {
      if (!req.body.firstName && !user) {
        return res.render("error", {
          err: "Email not registered. Register to continue",
        });
      }
    }
    const key = randomize("0", 4);
    req.body.otp = key;
    if (!user) {
      const formatDate = (dateString) => {
        const options = { year: "numeric", month: "long", day: "numeric" };
        return new Date(dateString).toLocaleDateString(undefined, options);
      };

      req.body.date = formatDate(req.body.date);

      const user = new User(req.body);
      try {
        await user.save();
        console.log(user.otp);
      } catch (err) {
        res.status(400).send({ err });
      }
      const subject = "[OneDayWarrior] Otp for registration is : " + key;
      const text = "Your OTP for registeration is " + key;
      sendMail(req.body.email, subject, text);
      res.render("verification", { msg: "OTP sent!" });
    } else {
      user.otp = key;
      await user.save();
      const subject = "[OneDayWarrior] OTP for verification is " + key;
      const text = "Already Registered! Your OTP for verification is " + key;
      sendMail(user.email, subject, text);
      res.render("verification", {
        msg: "Already Registed! Verify OTP to proceed!",
      });
    }
  } catch (err) {
    res.render("error", { err });
  }
});
router.get("/warriors", async (req, res) => {
  try {
    const users = await User.find({});
    let warriors = [];
    for (let i = 0; i < users.length; i++) {
      if (users[i].verified === true) {
        let obj = users[i];
        warriors.push(obj);
      }
    }

    let obje = { warriors };
    res.render("warriors", obje);
  } catch (err) {
    res.render("error", { err });
  }
});
router.get("/download", async (req, res) => {
  res.render("downloadcerti");
});
router.post("/resend", async (req, res) => {
  console.log(email, 12);
  try {
    const key = randomize("0", 4);
    const user = await User.findOne({ email });
    user.otp = key;

    await user.save();
    const subject = "[OneDayWarrior] OTP for verification is " + key;
    const text = "Your OTP for verification is " + key;
    sendMail(email, subject, text);

    res.render("verification", { msg: "new OTP sent" });
  } catch (err) {
    res.render("error", { err });
  }
});

router.post("/update", async (req, res) => {
  const updates = Object.keys(req.body);
  try {
    const user = await User.findOne({ email });
    updates.forEach((update) => (user[update] = req.body[update]));
    await user.save();

    if (!user) {
      return res.status(404).send("Not Found");
    }

    res.send(user);
  } catch (err) {
    res.status(400).send(err);
  }
});

router.post("/verify", async (req, res) => {
  try {
    const user = await User.findOne({ email });
    const key =
      req.body.digit1 + req.body.digit2 + req.body.digit3 + req.body.digit4;
    console.log(user.otp);
    console.log(key);
    console.log(user);
    if (user.otp == key) {
      user.verified = true;
      await user.save();
      await takeScreenshot(user);
      await createPDF(user);
      res.render("generated", {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        date: user.date,
      });
    } else {
      console.log(false);
      res.render("verification", { msg: "Incorrect OTP! New OTP sent" });
    }
  } catch (err) {
    res.render("error", { err });
  }
});
module.exports = router;
