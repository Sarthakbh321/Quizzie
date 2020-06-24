import React, { useState, useEffect } from "react";
import './QuizzesSection.css';
import axios from "axios";
import { GridList, GridListTile, GridListTileBar, Typography } from "@material-ui/core";

function QuizzesSection(props) {
	const [userType, setUserType] = useState(props.type);
	const [quizzes, setQuizzes] = useState([]);

	const getQuizzes = async () => {
		let token = localStorage.getItem("authToken");
		let url = "https://quizzie-api.herokuapp.com/quiz/all";

		try {
			await axios.get(url, {
				headers: {
					"auth-token": token,
				}
			}).then(res => {
				console.log(res);
				setQuizzes(res.data.result);
			})
		} catch(error) {
			console.log(error);
		}
	}


	useEffect(() => {
		getQuizzes();
	}, []);

	return (
		<div className="quizzes-section">
			<Typography variant="h5" className="up-quizzes">Upcoming Quizzes</Typography>
			{quizzes.length === 0? <p>Sorry! No quizzes available at the moment!</p>
			: 
				<div className="quiz-list root">
					<GridList cols={3} className="grid-list">
						{quizzes.map((quiz) => (
							<GridListTile key={quiz._id} className="quiz-tile">
								<img src="../CC LOGO-01.svg" />
								<GridListTileBar 
									title={quiz.quizName} 
									subtitle={`By: ${quiz.adminId.name}`}/>
							</GridListTile>
						))}
					</GridList>
				</div> 
			}
		</div>
	)
}

export default QuizzesSection;