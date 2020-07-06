import React, {useState, useEffect} from "react";
import axios from "axios";
import './OwnerQuizzes.css';
import { List, ListItem, ListItemText } from "@material-ui/core";

function OwnerQuizzes(props) {
	const [quizzes, setQuizzes] = useState([]);

	const getAllQuizzes = async () => {
		let token = localStorage.getItem("authToken");
		let url = "https://quizzie-api.herokuapp.com/owner/allQuizzes";

		try {
			await axios.get(url, {
				headers: {
					"auth-token": token
				}
			}).then(res => {
				setQuizzes(res.data.result);
			})
		} catch(error) {
			console.log(error);
		}
	}

	useEffect(() => {
		getAllQuizzes();
	})

	return (
		<div className="owner-quizzes">
			{quizzes.map(quiz => (
				<List aria-label="quiz display" className="owner-quiz-list">
					<ListItem button className="owner-quiz-item">
						<ListItemText primary={quiz.quizName} />
					</ListItem>
				</List>
			))}
		</div>
	)
}

export default OwnerQuizzes;