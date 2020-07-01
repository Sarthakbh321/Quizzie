const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const multer = require("multer");
const shortid = require("shortid");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const nodemailer = require("nodemailer");
//const sharp = require('sharp');
const Quiz = require("../models/quiz");
const Admin = require("../models/admin");
const User = require("../models/user");
const Question = require("../models/question");
const redis = require("redis");

const checkAuth = require("../middleware/checkAuth");
const checkAuthUser = require("../middleware/checkAuthUser");
const checkAuthAdmin = require("../middleware/checkAuthAdmin");

const REDIS_PORT = process.env.REDISTOGO_URL || 6379 || process.env.REDIS_URL;

const client = redis.createClient(REDIS_PORT);

const router = express.Router();

router.use(cookieParser());
router.use(
	session({
		secret: "mySecret",
		resave: false,
		saveUninitialized: false,
		cookie: {
			maxAge: 60 * 60 * 1000,
			expires: 40 * 60 * 1000,
		},
	})
);

////Create and Innitialise the quiz
router.post(
	"/createQuiz",
	checkAuth,
	checkAuthAdmin,
	async (req, res, next) => {
		if (req.body.quizType.toLowerCase() == "private") {
			const quiz = new Quiz({
				_id: new mongoose.Types.ObjectId(),
				quizName: req.body.quizName,
				adminId: req.user.userId,
				quizDate: req.body.quizDate,
				quizTime: req.body.quizTime,
				quizDuration: req.body.quizDuration,
				quizType: req.body.quizType.toLowerCase(),
				quizCode: shortid.generate(),
			});
			quiz
				.save()
				.then(async (result) => {
					const quizId = result._id;
					Admin.updateOne(
						{ _id: req.user.userId },
						{ $push: { quizzes: { quizId } } }
					)
						.then(async (result1) => {
							res.status(201).json({
								message: "created",
								result,
							});
						})
						.catch(async (err) => {
							res.status(400).json({ error: "err1" });
						});
				})
				.catch((err) => {
					res.status(400).json({ error: "err" });
				});
		} else {
			const quiz = new Quiz({
				_id: new mongoose.Types.ObjectId(),
				quizName: req.body.quizName,
				adminId: req.user.userId,
				quizDate: req.body.quizDate,
				quizTime: req.body.quizTime,
				quizDuration: req.body.quizDuration,
				quizType: req.body.quizType.toLowerCase(),
			});
			quiz
				.save()
				.then(async (result) => {
					const quizId = result._id;
					Admin.updateOne(
						{ _id: req.user.userId },
						{ $push: { quizzes: { quizId } } }
					)
						.then(async (result1) => {
							res.status(201).json({
								message: "created",
								result,
							});
						})
						.catch(async (err) => {
							res.status(400).json({ error: "err1" });
						});
				})
				.catch((err) => {
					res.status(400).json({ error: "err" });
				});
		}
	}
);

///Get all quiz for student dashboard
router.get("/all", checkAuth, async (req, res, next) => {
	Quiz.find({ quizType: "public" })
		.populate("adminId")
		.select("-__v")
		.exec()
		.then(async (result) => {
			await res.status(200).json({
				message: "Successfully retrieved",
				result,
			});
		})
		.catch((err) => {
			res.status(400).json({
				message: "An error occurred",
			});
		});
});

///Enroll/get access to a quiz
router.patch("/enroll", checkAuth, checkAuthUser, async (req, res, next) => {
	Quiz.findById(req.body.quizId)
		.exec()
		.then(async (result2) => {
			for (i = 0; i < result2.usersEnrolled.length; i++) {
				if (result2.usersEnrolled[i].userId == req.user.userId) {
					return res.status(409).json({ message: "Already enrolled" });
				}
			}
			const userId = req.user.userId;
			const quizId = req.body.quizId;
			await Quiz.updateOne(
				{ _id: quizId },
				{ $push: { usersEnrolled: { userId } } }
			)
				.exec()
				.then(async (result) => {
					await User.updateOne(
						{ _id: userId },
						{ $push: { quizzesEnrolled: { quizId } } }
					)
						.then(async (result1) => {
							await res.status(200).json({
								message: "Enrolled",
							});
						})
						.catch(async (err) => {
							res.status(400).json({
								message: "Some error",
							});
						});
				});
		})
		.catch(async (err) => {
			res.status(404).json({
				message: err,
			});
		})

		.catch(async (err) => {
			res.status(404).json({
				message: err,
			});
		});
});

// Enroll in a private quiz
router.patch(
	"/enrollPrivate",
	checkAuth,
	checkAuthUser,
	async (req, res, next) => {
		Quiz.findOne({ quizCode: req.body.quizCode })
			.exec()
			.then(async (result2) => {
				for (i = 0; i < result2.usersEnrolled.length; i++) {
					if (result2.usersEnrolled[i].userId == req.user.userId) {
						return res.status(409).json({ message: "Already enrolled" });
					}
				}
				const userId = req.user.userId;
				await Quiz.updateOne(
					{ quizCode: req.body.quizCode },
					{ $push: { usersEnrolled: { userId } } }
				)
					.exec()
					.then(async (result) => {
						const quizId = result2._id;
						await User.updateOne(
							{ _id: userId },
							{ $push: { quizzesEnrolled: { quizId } } }
						)
							.then(async (result1) => {
								await res.status(200).json({
									message: "Enrolled",
								});
							})
							.catch(async (err) => {
								res.status(400).json({
									message: "Some error",
								});
							});
					});
			})
			.catch(async (err) => {
				res.status(404).json({
					message: err,
				});
			})

			.catch(async (err) => {
				res.status(404).json({
					message: "Invalid Code",
				});
			});
	}
);

///Update Quiz
router.patch(
	"/updateDetails/:quizId",
	checkAuth,
	checkAuthAdmin,
	async (req, res, next) => {
		await Quiz.findById(req.params.quizId)
			.exec()
			.then(async (result1) => {
				if (result1.adminId != req.user.userId) {
					return res.status(401).json({
						message: "This is not your quiz",
					});
				}
				const id = req.params.quizId;
				const updateOps = {};
				var flag = 0;
				for (const ops of req.body) {
					updateOps[ops.propName] = ops.value;
				}
				Quiz.updateOne({ _id: id }, { $set: updateOps })
					.exec()
					.then((result) => {
						res.status(200).json({
							message: "Quiz updated",
						});
					})
					.catch((err) => {
						res.status(500).json({
							error: err,
						});
					});
			})
			.catch((err) => {
				res.status(400).json({
					message: "Some error",
				});
			});
	}
);

router.get("/checkAdmin", checkAuth, checkAuthAdmin, async (req, res, next) => {
	await Quiz.findOne({ _id: req.body.quizId })
		.then(async (result) => {
			if (result.adminId == req.user.userId) {
				return res.status(200).json({
					message: "This is your quiz",
				});
			} else {
				return res.status(401).json({
					message: "This is not your quiz",
				});
			}
		})
		.catch((err) => {
			res.status(400).json({
				message: "Please enter a correct quizId",
			});
		});
});

router.patch("/unenroll", checkAuth, checkAuthUser, async (req, res, next) => {
	await User.findById(req.user.userId)
		.then(async (result) => {
			var numQuiz = result.quizzesEnrolled.length;
			var flag = 0;
			for (i = 0; i < numQuiz; i++) {
				if (result.quizzesEnrolled[i].quizId == req.body.quizId) {
					flag = 1;
					var currentUser = req.user.userId;

					await User.updateOne(
						{ _id: currentUser },
						{ $pull: { quizzesEnrolled: { quizId: req.body.quizId } } }
					)
						.then((result) => {
							Quiz.updateOne(
								{ _id: req.body.quizId },
								{ $pull: { usersEnrolled: { userId: req.user.userId } } }
							)
								.then((result3) => {
									return res.status(200).json({
										message: "Successfully un-enrolled",
									});
								})
								.catch((err) => {
									return res.status(400).json({
										message: "Some error Occurred",
									});
								});
						})
						.catch((err) => {
							return res.status(400).json({
								message: "Error",
							});
						});
				}
			}
			if (flag === 0) {
				await res.status(401).json({
					message: "You are not a part of this quiz",
				});
			}
		})
		.catch(async (err) => {
			await res.status(400).json({
				message: "Error",
			});
		});
});

router.patch("/start", checkAuth, checkAuthUser, async (req, res, next) => {
	await Question.find({ quizId: req.body.quizId })
		.select("-__v")
		.exec()
		.then(async (result) => {
			await User.findById(req.user.userId)
				.then(async (result2) => {
					var flag = 0;
					var numQuiz = result2.quizzesStarted.length;
					var numEnrolled = result2.quizzesEnrolled.length;
					for (i = 0; i < numEnrolled; i++) {
						if (result2.quizzesEnrolled[i].quizId == req.body.quizId) {
							flag = 1;
						}
					}

					for (i = 0; i < numQuiz; i++) {
						if (result2.quizzesStarted[i].quizId == req.body.quizId) {
							return res.status(401).json({
								message: "Quiz already started",
							});
						}
					}
					if (flag === 0) {
						return res.status(400).json({
							message: "You are not enrolled in this quiz",
						});
					}
					// var clientId = questions+req.user.userId
					client.setex(req.user.userId, 3600, JSON.stringify(result));
					var quizId = req.body.quizId;
					req.session.questions = result;
					await User.updateOne(
						{ _id: req.user.userId },
						{ $push: { quizzesStarted: { quizId } } }
					)
						.exec()
						.then(async (result1) => {
							var data = [];
							for (i = 0; i < result.length; i++) {
								object = {
									quizId: result[i].quizId,
									description: result[i].description,
									options: result[i].options,
								};
								data.push(object);
							}
							await res.status(200).json({
								message: "Quiz started for " + req.user.name,
								data,
							});
						})
						.catch((err) => {
							res.status(400).json({
								message: "some error occurred",
							});
						});
				})
				.catch((err) => {
					res.status(400).json({
						message: "Some error Occurred",
					});
				});
		})
		.catch((err) => {
			res.status(400).json({
				message: "some error",
			});
		});
});

router.get("/:quizId", checkAuth, async (req, res, next) => {
	await Quiz.findById(req.params.quizId)
		.populate("adminId")
		.exec()
		.then((result) => {
			res.status(200).json({
				result,
			});
		})
		.catch((err) => {
			res.status(400).json({
				message: "some error occurred",
			});
		});
});

router.post("/check", checkAuth, checkAuthUser, async (req, res, next) => {
	const que_data = req.body.questions;
	var responses = [];
	client.get(req.user.userId, (err, data) => {
		if (err) {
			return res.status(400).json({
				message: "Error in cachin",
			});
		}
		dataQues = JSON.parse(data);
		c;
		if (data != null) {
			return res.status(200).json({
				dataQues,
			});
		} else {
			console.log("Couldn't find questions in cache");
		}
	});
});

router.delete("/delete", checkAuth, checkAuthAdmin, async (req, res, next) => {
	await Quiz.findById(req.body.quizId)
		.then(async (result) => {
			var numUsers = result.usersEnrolled.length;
			for (i = 0; i < numUsers; i++) {
				var currentUser = result.usersEnrolled[i].userId;
				await User.updateOne(
					{ _id: currentUser },
					{ $pull: { quizzesEnrolled: { quizId: req.body.quizId } } }
				)
					.then((result3) => {})
					.catch((err) => {
						res.status(400).json({
							message: "some error occurred",
						});
					});
			}
			await Question.deleteMany({ quizId: req.body.quizId })
				.then(async (result4) => {
					await Quiz.deleteOne({ _id: req.body.quizId })
						.then((result5) => {
							res.status(200).json({
								message: "Deleted successfully",
							});
						})
						.catch((err) => {
							res.status(400).json({
								message: "Some error",
							});
						});
				})
				.catch((err) => {
					res.status(400).json({
						message: "Errorr",
					});
				});
		})
		.catch((err) => {
			res.status(400).json({
				message: "Error",
			});
		});
});

router.patch(
	"/removeUser",
	checkAuth,
	checkAuthAdmin,
	async (req, res, next) => {
		await Quiz.updateOne(
			{ _id: req.body.quizId },
			{ $pull: { usersEnrolled: { userId: req.body.userId } } }
		)
			.then(async (result) => {
				await User.updateOne(
					{ _id: req.body.userId },
					{ $pull: { quizzesEnrolled: { quizId: req.body.quizId } } }
				).then((result)=>{
					res.status(200).json({
						message:'User removed successfully'
					})
				}).catch((err)=>{
					res.status(400).json({
						message:'Some error occurred'
					})
				})
			})
			.catch((err) => {
				res.status(400).json({
					message:'Some error'
				})
			});
	}
);

module.exports = router;