import { initializeApp } from "firebase/app";
import { createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword } from "firebase/auth";
import firebaseConfig from "./firebaseConfig.json";

const auth = getAuth(initializeApp(firebaseConfig));

const submitButton = document.getElementById("submit");
const signupButton = document.getElementById("sign-up");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const main = document.getElementById("main");
const createacct = document.getElementById("create-acct")

const signupEmailIn = document.getElementById("email-signup");
const confirmSignupEmailIn = document.getElementById("confirm-email-signup");
const signupPasswordIn = document.getElementById("password-signup");
const confirmSignUpPasswordIn = document.getElementById("confirm-password-signup");
const createacctbtn = document.getElementById("create-acct-btn");

const returnBtn = document.getElementById("return-btn");

createacctbtn.addEventListener("click", async function() {
  let isVerified = true;

  const signupEmail = signupEmailIn.value;
  const confirmSignupEmail = confirmSignupEmailIn.value;
  if(signupEmail != confirmSignupEmail) {
      window.alert("Email fields do not match. Try again.")
      isVerified = false;
  }

  const signupPassword = signupPasswordIn.value;
  const confirmSignUpPassword = confirmSignUpPasswordIn.value;
  if(signupPassword != confirmSignUpPassword) {
      window.alert("Password fields do not match. Try again.")
      isVerified = false;
  }
  
  if(!signupEmail || !confirmSignupEmail || !signupPassword || !confirmSignUpPassword) {
    window.alert("Please fill out all required fields.");
    isVerified = false;
  }
  
  if(isVerified) {
    try {
      await createUserWithEmailAndPassword(auth, signupEmail, signupPassword);
      window.alert("Success! Account created.");
    } catch (error) {
      console.error("Account creation failed:", error);
      window.alert(error.message);
    }
  }
});

submitButton.addEventListener("click", async function() {
  const email = emailInput.value;
  const password = passwordInput.value;

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    window.alert("Successfully logged in")
    console.log("Success! User info: ", userCredential.user);
  } catch (error) {
    console.error("Sign in failed:", error);
    window.alert(error.message);
  }
});

signupButton.addEventListener("click", function() {
    main.style.display = "none";
    createacct.style.display = "block";
});

returnBtn.addEventListener("click", function() {
    main.style.display = "block";
    createacct.style.display = "none";
});